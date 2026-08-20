use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::async_runtime::JoinHandle;

/// Live OAuth token material, held only in memory (never persisted as plaintext
/// except the two refresh tokens, which go into the OS keychain via `auth::keychain`).
#[derive(Clone, Debug, Default)]
pub struct TokenState {
    pub access_token: String,
    pub expires_at_unix: i64,
    pub google_refresh_token: String,
    pub firebase_id_token: String,
    pub firebase_refresh_token: String,
    pub firebase_uid: String,
    pub client_id: String,
    pub client_secret: String,
    pub firebase_api_key: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AuthProfile {
    pub email: String,
    pub name: String,
    pub picture: String,
    pub uid: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EventTemplate {
    pub id: String,
    pub title: String,
    pub color: String,
    pub duration_min: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Settings {
    pub watched_senders: Vec<String>,
    pub work_start: String, // "HH:MM"
    pub work_end: String,   // "HH:MM"
    pub poll_interval_sec: u64,
    pub mail_watch_enabled: bool,
    pub templates: Vec<EventTemplate>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            watched_senders: vec![],
            work_start: "09:00".into(),
            work_end: "18:00".into(),
            poll_interval_sec: 60,
            mail_watch_enabled: true,
            templates: vec![
                EventTemplate {
                    id: "tpl-meeting".into(),
                    title: "定例MTG".into(),
                    color: "#d4d4d8".into(),
                    duration_min: 30,
                },
                EventTemplate {
                    id: "tpl-focus".into(),
                    title: "集中作業".into(),
                    color: "#71717a".into(),
                    duration_min: 60,
                },
                EventTemplate {
                    id: "tpl-review".into(),
                    title: "レビュー".into(),
                    color: "#3f3f46".into(),
                    duration_min: 30,
                },
            ],
        }
    }
}

pub struct AppState {
    pub http: reqwest::Client,
    pub tokens: Mutex<Option<TokenState>>,
    pub poll_handle: Mutex<Option<JoinHandle<()>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            http: reqwest::Client::new(),
            tokens: Mutex::new(None),
            poll_handle: Mutex::new(None),
        }
    }
}
