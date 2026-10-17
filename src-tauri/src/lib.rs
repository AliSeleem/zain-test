pub mod db;

use db::{AppError, AppResult, DbConfig, LedgerRow, Session, Stats};
use serde::Serialize;
use sqlx::PgPool;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, State, WebviewWindow};
use tokio::sync::RwLock;

#[derive(Default)]
struct AppState {
    pool: RwLock<Option<PgPool>>,
}

async fn pool(state: &State<'_, AppState>) -> AppResult<PgPool> {
    state.pool.read().await.clone().ok_or_else(|| AppError::new("DBC-01", "not connected"))
}

fn config_path(app: &AppHandle) -> AppResult<PathBuf> {
    let dir = app.path().app_config_dir().map_err(|e| AppError::new("CFG-ERR", e))?;
    std::fs::create_dir_all(&dir).map_err(|e| AppError::new("CFG-ERR", e))?;
    Ok(dir.join("db.json"))
}

// ---------- Connection (BR-DBC-01) ----------

#[derive(Serialize)]
struct ConnectResult {
    connected: bool,
    config: Option<DbConfig>,
    error: Option<AppError>,
}

/// Called at start-up: tries the saved connection, and only asks the user
/// when there is none or it fails.
#[tauri::command]
async fn connect_saved(app: AppHandle, state: State<'_, AppState>) -> AppResult<ConnectResult> {
    let path = config_path(&app)?;
    let Ok(text) = std::fs::read_to_string(&path) else {
        return Ok(ConnectResult { connected: false, config: None, error: None });
    };
    let cfg: DbConfig = serde_json::from_str(&text).map_err(|e| AppError::new("CFG-ERR", e))?;
    match db::connect(&cfg).await {
        Ok(p) => {
            *state.pool.write().await = Some(p);
            Ok(ConnectResult { connected: true, config: Some(cfg), error: None })
        }
        Err(e) => Ok(ConnectResult { connected: false, config: Some(cfg), error: Some(e) }),
    }
}

#[tauri::command]
async fn connect_and_save(app: AppHandle, state: State<'_, AppState>, config: DbConfig) -> AppResult<()> {
    let p = db::connect(&config).await?;
    let text = serde_json::to_string_pretty(&config).map_err(|e| AppError::new("CFG-ERR", e))?;
    std::fs::write(config_path(&app)?, text).map_err(|e| AppError::new("CFG-ERR", e))?;
    *state.pool.write().await = Some(p);
    Ok(())
}

// ---------- Sessions (BR-LOG-03) ----------

#[tauri::command]
fn machine_name() -> String {
    gethostname::gethostname().to_string_lossy().into_owned()
}

#[tauri::command]
async fn login(state: State<'_, AppState>, username: String) -> AppResult<i64> {
    let username = username.trim().to_string();
    if username.is_empty() {
        return Err(AppError::new("LOG-01", "username is required"));
    }
    db::claim_session(&pool(&state).await?, &username, &machine_name()).await
}

#[tauri::command]
async fn heartbeat(state: State<'_, AppState>, session_id: i64) -> AppResult<bool> {
    db::heartbeat(&pool(&state).await?, session_id).await
}

#[tauri::command]
async fn logout(state: State<'_, AppState>, session_id: i64) -> AppResult<()> {
    db::release_session(&pool(&state).await?, session_id).await
}

#[derive(Serialize)]
struct SessionList {
    sessions: Vec<Session>,
    copies: i32,
}

#[tauri::command]
async fn list_sessions(state: State<'_, AppState>) -> AppResult<SessionList> {
    let (sessions, copies) = db::list_sessions(&pool(&state).await?).await?;
    Ok(SessionList { sessions, copies })
}

#[tauri::command]
async fn set_copies(state: State<'_, AppState>, copies: i32) -> AppResult<()> {
    db::set_copies(&pool(&state).await?, copies.max(1)).await
}

// ---------- Large data ----------

#[tauri::command]
async fn seed_rows(state: State<'_, AppState>, count: i32) -> AppResult<Stats> {
    db::seed_rows(&pool(&state).await?, count.clamp(1, 1_000_000)).await
}

#[tauri::command]
async fn row_stats(state: State<'_, AppState>) -> AppResult<Stats> {
    db::stats(&pool(&state).await?).await
}

#[tauri::command]
async fn fetch_rows(state: State<'_, AppState>, offset: i64, limit: i64) -> AppResult<Vec<LedgerRow>> {
    db::fetch_rows(&pool(&state).await?, offset, limit).await
}

#[tauri::command]
async fn clear_rows(state: State<'_, AppState>) -> AppResult<()> {
    db::clear_rows(&pool(&state).await?).await
}

// ---------- Windows and printing (BR-HOME-01, BR-HOME-05) ----------

/// Quitting is refused while other windows are open (HOME-02).
#[tauri::command]
fn request_quit(app: AppHandle) -> AppResult<()> {
    let open = app.webview_windows().len();
    if open > 1 {
        return Err(AppError::new("HOME-02", format!("{} windows open", open - 1)));
    }
    app.exit(0);
    Ok(())
}

#[tauri::command]
fn print_window(window: WebviewWindow) -> AppResult<()> {
    window.print().map_err(|e| AppError::new("PRN-ERR", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            connect_saved,
            connect_and_save,
            machine_name,
            login,
            heartbeat,
            logout,
            list_sessions,
            set_copies,
            seed_rows,
            row_stats,
            fetch_rows,
            clear_rows,
            request_quit,
            print_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running the app");
}
