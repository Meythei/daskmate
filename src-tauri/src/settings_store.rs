use std::sync::Arc;
use tauri::Wry;
use tauri_plugin_store::Store;

use crate::state::{AuthProfile, Settings};

pub fn load_settings_from_store(store: &Arc<Store<Wry>>) -> Settings {
    store
        .get("settings")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

pub fn load_settings(app: &tauri::AppHandle) -> Settings {
    use tauri_plugin_store::StoreExt;
    match app.store("app-data.json") {
        Ok(store) => load_settings_from_store(&store),
        Err(_) => Settings::default(),
    }
}

pub fn save_settings(store: &Arc<Store<Wry>>, settings: &Settings) {
    store.set("settings", serde_json::to_value(settings).unwrap());
    let _ = store.save();
}

pub fn load_profile(store: &Arc<Store<Wry>>) -> Option<AuthProfile> {
    store.get("profile").and_then(|v| serde_json::from_value(v).ok())
}

pub fn save_profile(store: &Arc<Store<Wry>>, profile: &AuthProfile) {
    store.set("profile", serde_json::to_value(profile).unwrap());
    let _ = store.save();
}

pub fn clear_profile(store: &Arc<Store<Wry>>) {
    store.delete("profile");
    let _ = store.save();
}

pub fn load_seen_ids(store: &Arc<Store<Wry>>) -> Vec<String> {
    store
        .get("seen_message_ids")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

pub fn save_seen_ids(store: &Arc<Store<Wry>>, ids: &[String]) {
    store.set("seen_message_ids", serde_json::to_value(ids).unwrap());
}

pub fn load_last_checked(store: &Arc<Store<Wry>>) -> i64 {
    store
        .get("last_checked_unix")
        .and_then(|v| v.as_i64())
        .unwrap_or_else(|| chrono::Utc::now().timestamp() - 3600)
}

pub fn save_last_checked(store: &Arc<Store<Wry>>, ts: i64) {
    store.set("last_checked_unix", serde_json::json!(ts));
}
