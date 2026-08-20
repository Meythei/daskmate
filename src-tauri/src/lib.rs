mod auth;
mod commands;
mod google_api;
mod mail_watch;
mod settings_store;
mod state;

use std::sync::Arc;
use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(Arc::new(AppState::new()))
        .invoke_handler(tauri::generate_handler![
            commands::start_google_login,
            commands::check_stored_login,
            commands::logout,
            commands::get_settings,
            commands::save_settings,
            commands::list_calendar_events,
            commands::list_week_events,
            commands::quick_fill_template,
            commands::delete_calendar_event,
            commands::poll_mail_now,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
