/// App configuration, loaded once at startup from a `.env` file (searched
/// upward from the working directory, so it's found whether Tauri launches
/// the process from the project root or from `src-tauri/`). Kept entirely on
/// the Rust side — nothing here is ever bundled into the frontend, unlike a
/// Vite `VITE_`-prefixed env var would be.
// Most of the Firebase fields below aren't read by the current REST-only auth
// flow (only firebase_api_key is) — they're kept so a config pasted straight
// out of the Firebase console's "SDK setup" snippet fits without editing.
#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct Config {
    pub google_client_id: String,
    pub google_client_secret: String,
    pub google_redirect_uri: String,
    pub firebase_api_key: String,
    pub firebase_auth_domain: String,
    pub firebase_database_url: String,
    pub firebase_project_id: String,
    pub firebase_storage_bucket: String,
    pub firebase_messaging_sender_id: String,
    pub firebase_app_id: String,
    pub firebase_measurement_id: String,
}

const DEFAULT_REDIRECT_URI: &str = "http://127.0.0.1:53682/callback";

impl Config {
    /// Returns `None` when the two required values (Google client ID and
    /// Firebase Web API key) aren't set — callers treat that as "not
    /// configured yet" rather than a hard failure, so the app still launches.
    pub fn from_env() -> Option<Self> {
        dotenvy::dotenv().ok();
        let get = |k: &str| std::env::var(k).ok().filter(|v| !v.is_empty());

        Some(Self {
            google_client_id: get("GOOGLE_CLIENT_ID")?,
            google_client_secret: get("GOOGLE_CLIENT_SECRET").unwrap_or_default(),
            google_redirect_uri: get("GOOGLE_REDIRECT_URI")
                .unwrap_or_else(|| DEFAULT_REDIRECT_URI.to_string()),
            firebase_api_key: get("FIREBASE_API_KEY")?,
            firebase_auth_domain: get("FIREBASE_AUTH_DOMAIN").unwrap_or_default(),
            firebase_database_url: get("FIREBASE_DATABASE_URL").unwrap_or_default(),
            firebase_project_id: get("FIREBASE_PROJECT_ID").unwrap_or_default(),
            firebase_storage_bucket: get("FIREBASE_STORAGE_BUCKET").unwrap_or_default(),
            firebase_messaging_sender_id: get("FIREBASE_MESSAGING_SENDER_ID").unwrap_or_default(),
            firebase_app_id: get("FIREBASE_APP_ID").unwrap_or_default(),
            firebase_measurement_id: get("FIREBASE_MEASUREMENT_ID").unwrap_or_default(),
        })
    }
}
