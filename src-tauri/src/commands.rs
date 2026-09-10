use std::str::FromStr;
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tauri_plugin_store::StoreExt;

use crate::auth;
use crate::google_api::{self, CalendarEvent};
use crate::mail_watch;
use crate::settings_store::{self};
use crate::state::{AppState, AuthProfile, Settings};

fn store_of(app: &AppHandle) -> Result<Arc<tauri_plugin_store::Store<tauri::Wry>>, String> {
    app.store("app-data.json").map_err(|e| e.to_string())
}

#[tauri::command]
pub fn is_configured(app: AppHandle) -> bool {
    app.state::<Arc<AppState>>().config.is_some()
}

#[tauri::command]
pub async fn start_google_login(app: AppHandle) -> Result<AuthProfile, String> {
    let config = app
        .state::<Arc<AppState>>()
        .config
        .clone()
        .ok_or_else(|| "GOOGLE_CLIENT_ID / FIREBASE_API_KEY が .env に設定されていません".to_string())?;

    let (tokens, profile) = auth::login_with_google(&app, &config).await?;

    auth::keychain::save(&tokens)?;
    let store = store_of(&app)?;
    settings_store::save_profile(&store, &profile);

    let state = app.state::<Arc<AppState>>();
    *state.tokens.lock().unwrap() = Some(tokens);

    mail_watch::spawn(app.clone());

    Ok(profile)
}

#[tauri::command]
pub async fn check_stored_login(app: AppHandle) -> Result<Option<AuthProfile>, String> {
    let Some(mut tokens) = auth::keychain::load() else {
        return Ok(None);
    };
    let state = app.state::<Arc<AppState>>();
    if let Err(e) = auth::refresh_tokens(&state.http, &mut tokens).await {
        eprintln!("[auth] stored session expired: {e}");
        auth::keychain::clear();
        return Ok(None);
    }
    auth::keychain::save(&tokens)?;
    *state.tokens.lock().unwrap() = Some(tokens);

    let store = store_of(&app)?;
    let profile = settings_store::load_profile(&store);
    if profile.is_some() {
        mail_watch::spawn(app.clone());
    }
    Ok(profile)
}

#[tauri::command]
pub async fn logout(app: AppHandle) -> Result<(), String> {
    auth::keychain::clear();
    let state = app.state::<Arc<AppState>>();
    *state.tokens.lock().unwrap() = None;
    mail_watch::stop(&app);
    let store = store_of(&app)?;
    settings_store::clear_profile(&store);
    Ok(())
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Result<Settings, String> {
    let store = store_of(&app)?;
    Ok(settings_store::load_settings_from_store(&store))
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: Settings) -> Result<(), String> {
    let store = store_of(&app)?;
    settings_store::save_settings(&store, &settings);
    mail_watch::spawn(app.clone());
    Ok(())
}

fn day_bounds(date: &str) -> Result<(chrono::NaiveDate, chrono::FixedOffset), String> {
    let d = chrono::NaiveDate::from_str(date).map_err(|e| e.to_string())?;
    // Use the machine's local UTC offset for "today" at noon as a stable reference.
    let now = chrono::Local::now();
    let offset = *now.offset();
    Ok((d, offset))
}

#[tauri::command]
pub async fn list_calendar_events(app: AppHandle, date: String) -> Result<Vec<CalendarEvent>, String> {
    let (d, offset) = day_bounds(&date)?;
    let start = offset
        .from_local_datetime(&d.and_hms_opt(0, 0, 0).unwrap())
        .unwrap();
    let end = offset
        .from_local_datetime(&d.and_hms_opt(23, 59, 59).unwrap())
        .unwrap();
    let state = app.state::<Arc<AppState>>();
    google_api::list_events(&state, &start.to_rfc3339(), &end.to_rfc3339()).await
}

#[tauri::command]
pub async fn list_week_events(app: AppHandle, week_start: String) -> Result<Vec<CalendarEvent>, String> {
    let (d, offset) = day_bounds(&week_start)?;
    let start = offset
        .from_local_datetime(&d.and_hms_opt(0, 0, 0).unwrap())
        .unwrap();
    let end_date = d + chrono::Duration::days(7);
    let end = offset
        .from_local_datetime(&end_date.and_hms_opt(0, 0, 0).unwrap())
        .unwrap()
        - chrono::Duration::seconds(1);
    let state = app.state::<Arc<AppState>>();
    google_api::list_events(&state, &start.to_rfc3339(), &end.to_rfc3339()).await
}

#[tauri::command]
pub async fn quick_fill_template(
    app: AppHandle,
    date: String,
    template_id: String,
) -> Result<Vec<CalendarEvent>, String> {
    let (d, offset) = day_bounds(&date)?;
    let store = store_of(&app)?;
    let settings = settings_store::load_settings_from_store(&store);
    let template = settings
        .templates
        .iter()
        .find(|t| t.id == template_id)
        .ok_or_else(|| "テンプレートが見つかりません".to_string())?
        .clone();

    let work_start = chrono::NaiveTime::parse_from_str(&settings.work_start, "%H:%M")
        .map_err(|e| e.to_string())?;
    let work_end = chrono::NaiveTime::parse_from_str(&settings.work_end, "%H:%M")
        .map_err(|e| e.to_string())?;

    let state = app.state::<Arc<AppState>>();
    google_api::quick_fill(
        &state,
        d,
        offset,
        work_start,
        work_end,
        &template.title,
        template.duration_min,
        Some(color_to_google_id(&template.color)),
    )
    .await
}

#[tauri::command]
pub async fn delete_calendar_event(app: AppHandle, event_id: String) -> Result<(), String> {
    let state = app.state::<Arc<AppState>>();
    google_api::delete_event(&state, &event_id).await
}

#[tauri::command]
pub async fn list_chat_spaces(app: AppHandle) -> Result<Vec<google_api::ChatSpace>, String> {
    let state = app.state::<Arc<AppState>>();
    google_api::list_chat_spaces(&state).await
}

#[tauri::command]
pub async fn send_chat_message(app: AppHandle, space_name: String, text: String) -> Result<(), String> {
    let state = app.state::<Arc<AppState>>();
    google_api::send_chat_message(&state, &space_name, &text).await
}

#[tauri::command]
pub async fn poll_mail_now(app: AppHandle) -> Result<(), String> {
    mail_watch::spawn(app);
    Ok(())
}

use chrono::TimeZone;

/// Maps our (monotone) template hex color to a Google Calendar "colorId"
/// (Calendar's event colors are a fixed palette of 11 hues, not arbitrary hex).
/// Graphite is the only true neutral in that palette, so every one of our
/// grayscale template colors maps to it — this keeps events gray when viewed
/// in the actual Google Calendar app too, not just inside DeskMate.
fn color_to_google_id(_hex: &str) -> &'static str {
    "8" // graphite
}
