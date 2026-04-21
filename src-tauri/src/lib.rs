mod db;
mod models;
mod tracker;

use std::sync::Mutex;

use db::Database;
use models::{
    BootstrapData, DashboardStats, DeleteProjectInput, NewEntryInput, NewProjectInput, TimeEntry,
    TrackerStatus, TrendPoint, UpdateEntryInput, UpdateProjectInput,
};
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{TrayIconBuilder, TrayIconEvent},
    Manager, State,
};
use tracker::{start_tracker, stop_tracker, TrackerHandle};

struct AppState {
    db: Database,
    tracker: Mutex<Option<TrackerHandle>>,
}

#[tauri::command]
fn get_bootstrap_data(state: State<AppState>) -> Result<BootstrapData, String> {
    let status = state
        .tracker
        .lock()
        .map_err(|e| e.to_string())?
        .as_ref()
        .map(|t| t.status())
        .unwrap_or(TrackerStatus {
            state: "stopped".to_string(),
            detail: None,
        });
    state.db.bootstrap(status)
}

#[tauri::command]
fn list_entries(state: State<AppState>) -> Result<Vec<TimeEntry>, String> {
    state.db.list_entries()
}

#[tauri::command]
fn create_entry(state: State<AppState>, input: NewEntryInput) -> Result<TimeEntry, String> {
    state.db.create_entry(input)
}

#[tauri::command]
fn update_entry(state: State<AppState>, input: UpdateEntryInput) -> Result<(), String> {
    state.db.update_entry(input)
}

#[tauri::command]
fn create_project(state: State<AppState>, input: NewProjectInput) -> Result<(), String> {
    state.db.create_project(input).map(|_| ())
}

#[tauri::command]
fn update_project(state: State<AppState>, input: UpdateProjectInput) -> Result<(), String> {
    state.db.update_project(input)
}

#[tauri::command]
fn delete_project(state: State<AppState>, input: DeleteProjectInput) -> Result<(), String> {
    state.db.delete_project(input)
}

#[tauri::command]
fn get_dashboard_stats(state: State<AppState>) -> Result<DashboardStats, String> {
    state.db.dashboard_stats()
}

#[tauri::command]
fn get_trend_7_days(state: State<AppState>) -> Result<Vec<TrendPoint>, String> {
    state.db.trend_7_days()
}

#[tauri::command]
fn get_tracker_status(state: State<AppState>) -> Result<TrackerStatus, String> {
    let lock = state.tracker.lock().map_err(|e| e.to_string())?;
    Ok(lock.as_ref().map(|t| t.status()).unwrap_or(TrackerStatus {
        state: "stopped".to_string(),
        detail: None,
    }))
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
            std::fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;
            let db_path = app_data_dir.join("timing.sqlite");
            let db = Database::new(db_path)?;
            let tracker = start_tracker(app.handle().clone(), db.clone());

            app.manage(AppState {
                db,
                tracker: Mutex::new(Some(tracker)),
            });

            // Build the system tray menu
            let show_i = MenuItemBuilder::new("Show Window")
                .id("show")
                .build(app)
                .map_err(|e| e.to_string())?;
            let quit_i = MenuItemBuilder::new("Quit")
                .id("quit")
                .build(app)
                .map_err(|e| e.to_string())?;

            let menu = MenuBuilder::new(app)
                .item(&show_i)
                .separator()
                .item(&quit_i)
                .build()
                .map_err(|e| e.to_string())?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().cloned().unwrap())
                .tooltip("Timing Desktop")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    // Left-click on the tray icon shows the window
                    if let TrayIconEvent::Click { button, .. } = event {
                        if button == tauri::tray::MouseButton::Left {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        // Cleanly stop the tracker before exiting
                        if let Some(state) = app.try_state::<AppState>() {
                            if let Ok(mut lock) = state.tracker.lock() {
                                if let Some(handle) = lock.take() {
                                    stop_tracker(&handle);
                                }
                            }
                        }
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)
                .map_err(|e| e.to_string())?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_bootstrap_data,
            list_entries,
            create_entry,
            update_entry,
            create_project,
            update_project,
            delete_project,
            get_dashboard_stats,
            get_trend_7_days,
            get_tracker_status
        ])
        .on_window_event(|window, event| {
            // Intercept close: hide to tray instead of quitting
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
