use chrono::{DateTime, Duration, FixedOffset, NaiveDate, NaiveTime, TimeZone};
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::auth;
use crate::state::AppState;

fn snapshot_tokens(state: &AppState) -> Result<crate::state::TokenState, String> {
    let guard = state.tokens.lock().unwrap();
    guard.clone().ok_or_else(|| "ログインしていません".to_string())
}

fn store_tokens(state: &AppState, tokens: crate::state::TokenState) {
    *state.tokens.lock().unwrap() = Some(tokens);
}

async fn do_send(
    http: &reqwest::Client,
    method: &reqwest::Method,
    url: &str,
    body: &Option<serde_json::Value>,
    access_token: &str,
) -> Result<reqwest::Response, String> {
    let mut req = http.request(method.clone(), url).bearer_auth(access_token);
    if let Some(b) = body {
        req = req.json(b);
    }
    req.send().await.map_err(|e| e.to_string())
}

async fn authorized_request(
    state: &AppState,
    method: reqwest::Method,
    url: &str,
    body: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let mut tokens = snapshot_tokens(state)?;

    // Refresh proactively if the token is expiring, then retry once on 401.
    if auth::is_expiring(&tokens) {
        auth::refresh_tokens(&state.http, &mut tokens).await?;
        let _ = auth::keychain::save(&tokens);
        store_tokens(state, tokens.clone());
    }

    let mut res = do_send(&state.http, &method, url, &body, &tokens.access_token).await?;

    if res.status().as_u16() == 401 {
        auth::refresh_tokens(&state.http, &mut tokens).await?;
        let _ = auth::keychain::save(&tokens);
        store_tokens(state, tokens.clone());
        res = do_send(&state.http, &method, url, &body, &tokens.access_token).await?;
    }

    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        return Err(format!("Google API エラー ({status}): {text}"));
    }
    res.json::<serde_json::Value>().await.map_err(|e| e.to_string())
}

// ---------- Gmail ----------

pub async fn list_new_message_ids(
    state: &AppState,
    senders: &[String],
    after_unix: i64,
) -> Result<Vec<String>, String> {
    if senders.is_empty() {
        return Ok(vec![]);
    }
    let from_clause = senders
        .iter()
        .map(|s| format!("from:{s}"))
        .collect::<Vec<_>>()
        .join(" OR ");
    let query = format!("({from_clause}) after:{after_unix}");
    let url = format!(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages?q={}&maxResults=15",
        auth_encode(&query)
    );
    let json = authorized_request(state, reqwest::Method::GET, &url, None).await?;
    let ids = json
        .get("messages")
        .and_then(|m| m.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|m| m.get("id").and_then(|v| v.as_str()).map(String::from))
                .collect()
        })
        .unwrap_or_default();
    Ok(ids)
}

#[derive(Serialize, Clone)]
pub struct MailNotice {
    pub from: String,
    pub subject: String,
}

pub async fn get_message_notice(state: &AppState, id: &str) -> Result<MailNotice, String> {
    let url = format!(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/{id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject"
    );
    let json = authorized_request(state, reqwest::Method::GET, &url, None).await?;
    let headers = json
        .get("payload")
        .and_then(|p| p.get("headers"))
        .and_then(|h| h.as_array())
        .cloned()
        .unwrap_or_default();
    let find = |name: &str| -> String {
        headers
            .iter()
            .find(|h| h.get("name").and_then(|v| v.as_str()) == Some(name))
            .and_then(|h| h.get("value").and_then(|v| v.as_str()))
            .unwrap_or("")
            .to_string()
    };
    Ok(MailNotice {
        from: find("From"),
        subject: find("Subject"),
    })
}

// ---------- Calendar ----------

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CalendarEvent {
    pub id: String,
    pub summary: String,
    pub start: String, // RFC3339
    pub end: String,   // RFC3339
    #[serde(default)]
    pub color_id: Option<String>,
}

fn parse_event(v: &serde_json::Value) -> Option<CalendarEvent> {
    let id = v.get("id")?.as_str()?.to_string();
    let summary = v
        .get("summary")
        .and_then(|s| s.as_str())
        .unwrap_or("(無題)")
        .to_string();
    let start = v.get("start")?.get("dateTime")?.as_str()?.to_string();
    let end = v.get("end")?.get("dateTime")?.as_str()?.to_string();
    let color_id = v
        .get("colorId")
        .and_then(|c| c.as_str())
        .map(String::from);
    Some(CalendarEvent {
        id,
        summary,
        start,
        end,
        color_id,
    })
}

pub async fn list_events(
    state: &AppState,
    time_min: &str,
    time_max: &str,
) -> Result<Vec<CalendarEvent>, String> {
    let url = format!(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin={}&timeMax={}&singleEvents=true&orderBy=startTime",
        auth_encode(time_min),
        auth_encode(time_max)
    );
    let json = authorized_request(state, reqwest::Method::GET, &url, None).await?;
    let items = json.get("items").and_then(|i| i.as_array()).cloned().unwrap_or_default();
    Ok(items.iter().filter_map(parse_event).collect())
}

pub async fn insert_event(
    state: &AppState,
    summary: &str,
    start: &DateTime<FixedOffset>,
    end: &DateTime<FixedOffset>,
    color_id: Option<&str>,
) -> Result<CalendarEvent, String> {
    let mut body = json!({
        "summary": summary,
        "start": { "dateTime": start.to_rfc3339() },
        "end": { "dateTime": end.to_rfc3339() },
    });
    if let Some(c) = color_id {
        body["colorId"] = json!(c);
    }
    let url = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
    let json = authorized_request(state, reqwest::Method::POST, url, Some(body)).await?;
    parse_event(&json).ok_or_else(|| "予定の作成応答を解析できませんでした".to_string())
}

pub async fn patch_event_time(
    state: &AppState,
    event_id: &str,
    start: &DateTime<FixedOffset>,
    end: &DateTime<FixedOffset>,
) -> Result<CalendarEvent, String> {
    let body = json!({
        "start": { "dateTime": start.to_rfc3339() },
        "end": { "dateTime": end.to_rfc3339() },
    });
    let url = format!(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events/{event_id}"
    );
    let json = authorized_request(state, reqwest::Method::PATCH, &url, Some(body)).await?;
    parse_event(&json).ok_or_else(|| "予定の更新応答を解析できませんでした".to_string())
}

pub async fn delete_event(state: &AppState, event_id: &str) -> Result<(), String> {
    let url = format!(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events/{event_id}"
    );
    authorized_request(state, reqwest::Method::DELETE, &url, None).await.ok();
    Ok(())
}

fn auth_encode(s: &str) -> String {
    url::form_urlencoded::byte_serialize(s.as_bytes()).collect()
}

/// Packs a template event into the earliest free 30-minute-aligned slot within
/// the configured work hours, merging into an adjacent same-title event instead
/// of creating a visually-duplicated back-to-back block when possible.
pub async fn quick_fill(
    state: &AppState,
    date: NaiveDate,
    tz_offset: FixedOffset,
    work_start: NaiveTime,
    work_end: NaiveTime,
    title: &str,
    duration_min: i64,
    color_id: Option<&str>,
) -> Result<Vec<CalendarEvent>, String> {
    let day_start = tz_offset.from_local_datetime(&date.and_time(work_start)).unwrap();
    let day_end = tz_offset.from_local_datetime(&date.and_time(work_end)).unwrap();

    let existing = list_events(state, &day_start.to_rfc3339(), &day_end.to_rfc3339()).await?;
    let mut existing: Vec<CalendarEvent> = existing
        .into_iter()
        .filter(|e| {
            DateTime::parse_from_rfc3339(&e.start).is_ok() && DateTime::parse_from_rfc3339(&e.end).is_ok()
        })
        .collect();
    existing.sort_by_key(|e| e.start.clone());

    let step = Duration::minutes(30);
    let want = Duration::minutes(duration_min);

    let mut cursor = day_start;
    let mut found_start: Option<DateTime<FixedOffset>> = None;
    while cursor + want <= day_end {
        let slot_end = cursor + want;
        let overlaps = existing.iter().any(|e| {
            let es = DateTime::parse_from_rfc3339(&e.start).unwrap();
            let ee = DateTime::parse_from_rfc3339(&e.end).unwrap();
            es < slot_end && cursor < ee
        });
        if !overlaps {
            found_start = Some(cursor);
            break;
        }
        cursor = cursor + step;
    }

    let start = found_start.ok_or_else(|| "空いている時間がありません".to_string())?;
    let end = start + want;

    // Merge with an immediately-preceding event of the same title.
    let prev = existing.iter().find(|e| {
        e.summary == title && DateTime::parse_from_rfc3339(&e.end).unwrap() == start
    }).cloned();
    // Merge with an immediately-following event of the same title.
    let next = existing.iter().find(|e| {
        e.summary == title && DateTime::parse_from_rfc3339(&e.start).unwrap() == end
    }).cloned();

    match (prev, next) {
        (Some(p), Some(n)) => {
            // Extend `p` all the way to `n`'s end, then drop `n`.
            let n_end = DateTime::parse_from_rfc3339(&n.end).unwrap();
            let p_start = DateTime::parse_from_rfc3339(&p.start).unwrap();
            let updated = patch_event_time(state, &p.id, &p_start, &n_end).await?;
            delete_event(state, &n.id).await?;
            Ok(vec![updated])
        }
        (Some(p), None) => {
            let p_start = DateTime::parse_from_rfc3339(&p.start).unwrap();
            let updated = patch_event_time(state, &p.id, &p_start, &end).await?;
            Ok(vec![updated])
        }
        (None, Some(n)) => {
            let n_end = DateTime::parse_from_rfc3339(&n.end).unwrap();
            let updated = patch_event_time(state, &n.id, &start, &n_end).await?;
            Ok(vec![updated])
        }
        (None, None) => {
            let created = insert_event(state, title, &start, &end, color_id).await?;
            Ok(vec![created])
        }
    }
}

// ---------- Google Chat ----------

#[derive(Serialize, Clone)]
pub struct ChatSpace {
    pub name: String, // "spaces/AAAAxxxxxxx"
    pub display_name: String,
    pub space_type: String, // "SPACE" | "GROUP_CHAT" | "DIRECT_MESSAGE"
}

fn parse_space(v: &serde_json::Value) -> Option<ChatSpace> {
    let name = v.get("name")?.as_str()?.to_string();
    let space_type = v
        .get("spaceType")
        .and_then(|s| s.as_str())
        .unwrap_or("SPACE")
        .to_string();
    let display_name = v
        .get("displayName")
        .and_then(|s| s.as_str())
        .filter(|s| !s.is_empty())
        .map(String::from)
        .unwrap_or_else(|| match space_type.as_str() {
            "DIRECT_MESSAGE" => "ダイレクトメッセージ".to_string(),
            "GROUP_CHAT" => "グループチャット".to_string(),
            _ => name.clone(),
        });
    Some(ChatSpace {
        name,
        display_name,
        space_type,
    })
}

/// Lists the Chat spaces (rooms, group chats, DMs) the signed-in user belongs
/// to, across all pages.
pub async fn list_chat_spaces(state: &AppState) -> Result<Vec<ChatSpace>, String> {
    let mut spaces = Vec::new();
    let mut page_token: Option<String> = None;
    loop {
        let mut url = "https://chat.googleapis.com/v1/spaces?pageSize=100".to_string();
        if let Some(token) = &page_token {
            url.push_str(&format!("&pageToken={}", auth_encode(token)));
        }
        let json = authorized_request(state, reqwest::Method::GET, &url, None).await?;
        if let Some(items) = json.get("spaces").and_then(|s| s.as_array()) {
            spaces.extend(items.iter().filter_map(parse_space));
        }
        page_token = json
            .get("nextPageToken")
            .and_then(|t| t.as_str())
            .map(String::from);
        if page_token.is_none() {
            break;
        }
    }
    Ok(spaces)
}

/// Sends a plain-text message to a Chat space as the signed-in user.
pub async fn send_chat_message(state: &AppState, space_name: &str, text: &str) -> Result<(), String> {
    let url = format!("https://chat.googleapis.com/v1/{space_name}/messages");
    let body = json!({ "text": text });
    authorized_request(state, reqwest::Method::POST, &url, Some(body)).await?;
    Ok(())
}
