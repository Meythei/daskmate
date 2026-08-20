use std::sync::Arc;
use std::time::Duration as StdDuration;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_store::StoreExt;

use crate::google_api;
use crate::settings_store::{load_settings, load_seen_ids, save_seen_ids, load_last_checked, save_last_checked};
use crate::state::AppState;

const STORE_FILE: &str = "app-data.json";
const MAX_SEEN: usize = 300;

/// Starts (or restarts) the background Gmail polling loop. Runs entirely while
/// the app process is alive — no OS-level background service.
pub fn spawn(app: AppHandle) {
    let state = app.state::<Arc<AppState>>().inner().clone();

    if let Some(handle) = state.poll_handle.lock().unwrap().take() {
        handle.abort();
    }

    let app_for_task = app.clone();
    let state_for_task = state.clone();
    let handle = tauri::async_runtime::spawn(async move {
        loop {
            let settings = load_settings(&app_for_task);
            let interval = settings.poll_interval_sec.max(15);

            if settings.mail_watch_enabled && !settings.watched_senders.is_empty() {
                let logged_in = state_for_task.tokens.lock().unwrap().is_some();
                if logged_in {
                    if let Err(e) = poll_once(&app_for_task, &state_for_task, &settings.watched_senders).await {
                        eprintln!("[mail_watch] poll error: {e}");
                        if e.contains("ログイン") {
                            let _ = app_for_task.emit("auth://signed-out", ());
                            break;
                        }
                    }
                }
            }

            tokio::time::sleep(StdDuration::from_secs(interval)).await;
        }
    });

    *state.poll_handle.lock().unwrap() = Some(handle);
}

pub fn stop(app: &AppHandle) {
    let state = app.state::<Arc<AppState>>().inner().clone();
    let handle = state.poll_handle.lock().unwrap().take();
    if let Some(handle) = handle {
        handle.abort();
    }
}

async fn poll_once(app: &AppHandle, state: &Arc<AppState>, senders: &[String]) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    let after = load_last_checked(&store);
    let now = chrono::Utc::now().timestamp();

    let ids = google_api::list_new_message_ids(state, senders, after).await?;
    let mut seen = load_seen_ids(&store);

    let mut fresh: Vec<String> = ids.into_iter().filter(|id| !seen.contains(id)).collect();
    fresh.truncate(8); // avoid a notification storm after a long offline period

    for id in &fresh {
        match google_api::get_message_notice(state, id).await {
            Ok(notice) => {
                let _ = app
                    .notification()
                    .builder()
                    .title(clean_from(&notice.from))
                    .body(notice.subject.clone())
                    .show();
                let _ = app.emit("mail://new", &notice);
            }
            Err(e) => eprintln!("[mail_watch] fetch message failed: {e}"),
        }
        seen.push(id.clone());
    }

    if seen.len() > MAX_SEEN {
        let drop_count = seen.len() - MAX_SEEN;
        seen.drain(0..drop_count);
    }
    save_seen_ids(&store, &seen);
    save_last_checked(&store, now - 5); // 5s overlap safety margin
    let _ = store.save();

    Ok(())
}

fn clean_from(header: &str) -> String {
    // "Taro Yamada <taro@example.com>" -> "Taro Yamada"
    if let Some(idx) = header.find('<') {
        header[..idx].trim().trim_matches('"').to_string()
    } else {
        header.to_string()
    }
}
