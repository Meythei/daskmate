use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::RngCore;
use serde::Deserialize;
use serde_json::json;
use sha2::{Digest, Sha256};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::state::{AuthProfile, TokenState};

const GOOGLE_AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const FIREBASE_SIGNIN_IDP_URL: &str =
    "https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp";
const FIREBASE_REFRESH_URL: &str = "https://securetoken.googleapis.com/v1/token";

const SCOPES: &str = "openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/chat.spaces.readonly https://www.googleapis.com/auth/chat.messages.create";

fn now_unix() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64
}

fn random_url_safe(len_bytes: usize) -> String {
    let mut bytes = vec![0u8; len_bytes];
    rand::thread_rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

fn pkce_challenge(verifier: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(hasher.finalize())
}

/// Decode (without signature verification — we obtained this JWT directly from
/// Google's token endpoint over TLS, so the transport itself is the trust anchor)
/// the payload of a Google id_token JWT to pull basic profile fields.
fn decode_id_token_profile(id_token: &str) -> Option<(String, String, String)> {
    let parts: Vec<&str> = id_token.split('.').collect();
    if parts.len() != 3 {
        return None;
    }
    let payload_bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(parts[1])
        .ok()?;
    let payload: serde_json::Value = serde_json::from_slice(&payload_bytes).ok()?;
    let email = payload.get("email")?.as_str()?.to_string();
    let name = payload
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or(&email)
        .to_string();
    let picture = payload
        .get("picture")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    Some((email, name, picture))
}

#[derive(Deserialize)]
struct GoogleTokenResponse {
    access_token: String,
    expires_in: i64,
    refresh_token: Option<String>,
    id_token: Option<String>,
}

#[derive(Deserialize)]
struct FirebaseSignInResponse {
    #[serde(rename = "idToken")]
    id_token: String,
    #[serde(rename = "refreshToken")]
    refresh_token: String,
    #[serde(rename = "localId")]
    local_id: String,
}

/// Runs the full "installed app" OAuth loopback flow: opens the user's system
/// browser to Google's consent screen and waits on a local HTTP server for the
/// redirect carrying the authorization code. Required because Google refuses to
/// show its consent screen inside an embedded webview (Tauri's webview included).
pub async fn login_with_google(
    _app: &tauri::AppHandle,
    config: &crate::config::Config,
) -> Result<(TokenState, AuthProfile), String> {
    let code_verifier = random_url_safe(64);
    let code_challenge = pkce_challenge(&code_verifier);
    let csrf_state = random_url_safe(16);

    let redirect_uri = config.google_redirect_uri.clone();
    let parsed_redirect = url::Url::parse(&redirect_uri)
        .map_err(|e| format!("GOOGLE_REDIRECT_URI が不正です: {e}"))?;
    let host = parsed_redirect.host_str().unwrap_or("127.0.0.1").to_string();
    let port = parsed_redirect.port().unwrap_or(80);
    let callback_path = parsed_redirect.path().to_string();

    // Bind the configured loopback host/port for the redirect.
    let server = tiny_http::Server::http(format!("{host}:{port}")).map_err(|e| {
        format!(
            "ローカル待受サーバー ({host}:{port}) の起動に失敗しました。他のアプリがこのポートを使用していないか確認するか、GOOGLE_REDIRECT_URI のポートを変更してください: {e}"
        )
    })?;

    let auth_url = format!(
        "{base}?client_id={cid}&redirect_uri={redir}&response_type=code&scope={scope}&code_challenge={chal}&code_challenge_method=S256&state={state}&access_type=offline&prompt=consent%20select_account",
        base = GOOGLE_AUTH_URL,
        cid = urlencoding::encode(&config.google_client_id),
        redir = urlencoding::encode(&redirect_uri),
        scope = urlencoding::encode(SCOPES),
        chal = code_challenge,
        state = csrf_state,
    );

    tauri_plugin_opener::open_url(auth_url, None::<String>)
        .map_err(|e| format!("ブラウザを開けませんでした: {e}"))?;

    let expected_state = csrf_state.clone();
    let code = tokio::task::spawn_blocking(move || -> Result<String, String> {
        loop {
            let request = server
                .recv_timeout(std::time::Duration::from_secs(180))
                .map_err(|e| e.to_string())?
                .ok_or_else(|| "ログインがタイムアウトしました".to_string())?;
            let url = request.url().to_string();
            if !url.starts_with(&callback_path) {
                let response = tiny_http::Response::from_string("not found")
                    .with_status_code(404);
                let _ = request.respond(response);
                continue;
            }
            let parsed = url::Url::parse(&format!("http://{host}:{port}{url}")).map_err(|e| e.to_string())?;
            let mut code: Option<String> = None;
            let mut state: Option<String> = None;
            let mut err: Option<String> = None;
            for (k, v) in parsed.query_pairs() {
                match k.as_ref() {
                    "code" => code = Some(v.to_string()),
                    "state" => state = Some(v.to_string()),
                    "error" => err = Some(v.to_string()),
                    _ => {}
                }
            }
            let html = if err.is_some() {
                "<html><body style='font-family:sans-serif;padding:2rem'><h2>ログインがキャンセルされました</h2><p>このタブは閉じて構いません。</p></body></html>"
            } else {
                "<html><body style='font-family:sans-serif;padding:2rem'><h2>ログイン完了 ✓</h2><p>DeskMate に戻ってください。このタブは閉じて構いません。</p></body></html>"
            };
            let response = tiny_http::Response::from_string(html).with_header(
                tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"text/html; charset=utf-8"[..]).unwrap(),
            );
            let _ = request.respond(response);

            if let Some(e) = err {
                return Err(format!("Google認証が拒否されました: {e}"));
            }
            let code = code.ok_or_else(|| "認証コードを受信できませんでした".to_string())?;
            let state = state.unwrap_or_default();
            if state != expected_state {
                return Err("CSRF state が一致しません".to_string());
            }
            return Ok(code);
        }
    })
    .await
    .map_err(|e| e.to_string())??;

    let http = reqwest::Client::new();

    let mut form = vec![
        ("client_id", config.google_client_id.clone()),
        ("code", code),
        ("code_verifier", code_verifier),
        ("grant_type", "authorization_code".to_string()),
        ("redirect_uri", redirect_uri),
    ];
    if !config.google_client_secret.is_empty() {
        form.push(("client_secret", config.google_client_secret.clone()));
    }

    let token_res: GoogleTokenResponse = http
        .post(GOOGLE_TOKEN_URL)
        .form(&form)
        .send()
        .await
        .map_err(|e| format!("トークン取得に失敗しました: {e}"))?
        .error_for_status()
        .map_err(|e| format!("トークン取得に失敗しました: {e}"))?
        .json()
        .await
        .map_err(|e| format!("トークン応答の解析に失敗しました: {e}"))?;

    let id_token = token_res
        .id_token
        .clone()
        .ok_or_else(|| "id_token が返されませんでした".to_string())?;
    let (email, name, picture) =
        decode_id_token_profile(&id_token).ok_or_else(|| "id_token の解析に失敗しました".to_string())?;

    let firebase_res: FirebaseSignInResponse = http
        .post(FIREBASE_SIGNIN_IDP_URL)
        .query(&[("key", config.firebase_api_key.as_str())])
        .json(&json!({
            "postBody": format!("id_token={id_token}&providerId=google.com"),
            "requestUri": "http://localhost",
            "returnSecureToken": true,
        }))
        .send()
        .await
        .map_err(|e| format!("Firebaseサインインに失敗しました: {e}"))?
        .error_for_status()
        .map_err(|e| format!("Firebaseサインインに失敗しました: {e}"))?
        .json()
        .await
        .map_err(|e| format!("Firebase応答の解析に失敗しました: {e}"))?;

    let tokens = TokenState {
        access_token: token_res.access_token,
        expires_at_unix: now_unix() + token_res.expires_in - 30,
        google_refresh_token: token_res.refresh_token.unwrap_or_default(),
        firebase_id_token: firebase_res.id_token,
        firebase_refresh_token: firebase_res.refresh_token,
        firebase_uid: firebase_res.local_id.clone(),
        client_id: config.google_client_id.clone(),
        client_secret: config.google_client_secret.clone(),
        firebase_api_key: config.firebase_api_key.clone(),
    };
    let profile = AuthProfile {
        email,
        name,
        picture,
        uid: firebase_res.local_id,
    };

    Ok((tokens, profile))
}

/// Refreshes the Google access token (and, best-effort, the Firebase id token)
/// using the stored refresh tokens. Called proactively before an expiring API
/// call and reactively on a 401.
pub async fn refresh_tokens(http: &reqwest::Client, tokens: &mut TokenState) -> Result<(), String> {
    if tokens.google_refresh_token.is_empty() {
        return Err("リフレッシュトークンがありません。再ログインしてください。".into());
    }
    let mut form = vec![
        ("client_id", tokens.client_id.clone()),
        ("refresh_token", tokens.google_refresh_token.clone()),
        ("grant_type", "refresh_token".to_string()),
    ];
    if !tokens.client_secret.is_empty() {
        form.push(("client_secret", tokens.client_secret.clone()));
    }
    let res: GoogleTokenResponse = http
        .post(GOOGLE_TOKEN_URL)
        .form(&form)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    tokens.access_token = res.access_token;
    tokens.expires_at_unix = now_unix() + res.expires_in - 30;

    if !tokens.firebase_refresh_token.is_empty() {
        if let Ok(fb) = http
            .post(FIREBASE_REFRESH_URL)
            .query(&[("key", tokens.firebase_api_key.as_str())])
            .form(&[
                ("grant_type", "refresh_token"),
                ("refresh_token", tokens.firebase_refresh_token.as_str()),
            ])
            .send()
            .await
        {
            if let Ok(json) = fb.json::<serde_json::Value>().await {
                if let Some(id_token) = json.get("id_token").and_then(|v| v.as_str()) {
                    tokens.firebase_id_token = id_token.to_string();
                }
                if let Some(rt) = json.get("refresh_token").and_then(|v| v.as_str()) {
                    tokens.firebase_refresh_token = rt.to_string();
                }
            }
        }
    }

    Ok(())
}

pub fn is_expiring(tokens: &TokenState) -> bool {
    now_unix() >= tokens.expires_at_unix
}

/// OS keychain persistence for the two long-lived refresh tokens, so login
/// survives an app restart without re-showing the consent screen.
pub mod keychain {
    use super::TokenState;
    use serde::{Deserialize, Serialize};

    const SERVICE: &str = "com.smaru.deskmate";
    const ACCOUNT: &str = "google-account";

    #[derive(Serialize, Deserialize)]
    struct Persisted {
        google_refresh_token: String,
        firebase_refresh_token: String,
        firebase_uid: String,
        client_id: String,
        client_secret: String,
        firebase_api_key: String,
    }

    pub fn save(tokens: &TokenState) -> Result<(), String> {
        let entry = keyring::Entry::new(SERVICE, ACCOUNT).map_err(|e| e.to_string())?;
        let payload = Persisted {
            google_refresh_token: tokens.google_refresh_token.clone(),
            firebase_refresh_token: tokens.firebase_refresh_token.clone(),
            firebase_uid: tokens.firebase_uid.clone(),
            client_id: tokens.client_id.clone(),
            client_secret: tokens.client_secret.clone(),
            firebase_api_key: tokens.firebase_api_key.clone(),
        };
        let json = serde_json::to_string(&payload).map_err(|e| e.to_string())?;
        entry.set_password(&json).map_err(|e| e.to_string())
    }

    pub fn load() -> Option<TokenState> {
        let entry = keyring::Entry::new(SERVICE, ACCOUNT).ok()?;
        let json = entry.get_password().ok()?;
        let payload: Persisted = serde_json::from_str(&json).ok()?;
        Some(TokenState {
            access_token: String::new(),
            expires_at_unix: 0,
            google_refresh_token: payload.google_refresh_token,
            firebase_id_token: String::new(),
            firebase_refresh_token: payload.firebase_refresh_token,
            firebase_uid: payload.firebase_uid,
            client_id: payload.client_id,
            client_secret: payload.client_secret,
            firebase_api_key: payload.firebase_api_key,
        })
    }

    pub fn clear() {
        if let Ok(entry) = keyring::Entry::new(SERVICE, ACCOUNT) {
            let _ = entry.delete_credential();
        }
    }
}

mod urlencoding {
    pub fn encode(s: &str) -> String {
        url::form_urlencoded::byte_serialize(s.as_bytes()).collect()
    }
}
