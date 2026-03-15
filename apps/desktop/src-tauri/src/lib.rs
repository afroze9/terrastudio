use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use tauri::{Emitter, Manager};
use tauri::webview::WebviewWindowBuilder;
use tauri_plugin_log::{Target, TargetKind, RotationStrategy, TimezoneStrategy};

mod azure;
mod project;
mod security;
mod terraform;

/// Holds a pending project path received via file association before the frontend was ready.
pub struct PendingOpenPath(pub Mutex<Option<String>>);

/// Holds pending project paths for newly created windows (window_label → project_path).
pub struct PendingWindowPaths(pub Mutex<HashMap<String, String>>);

/// Counter for generating unique window labels.
static WINDOW_COUNTER: AtomicU32 = AtomicU32::new(1);

/// Compute a date-stamped log file name: "terrastudio-YYYY-MM-DD"
/// (the plugin appends ".log" automatically).
fn log_file_name() -> String {
    use time::OffsetDateTime;
    let now = OffsetDateTime::now_local().unwrap_or_else(|_| OffsetDateTime::now_utc());
    format!("terrastudio-{:04}-{:02}-{:02}", now.year(), now.month() as u8, now.day())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Build log targets: file always, stdout only in dev
    let mut log_targets = vec![
        Target::new(TargetKind::LogDir {
            file_name: Some(log_file_name()),
        }),
    ];
    if cfg!(debug_assertions) {
        log_targets.push(Target::new(TargetKind::Stdout));
    }

    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets(log_targets)
                .level(log::LevelFilter::Info)
                .rotation_strategy(RotationStrategy::KeepOne)
                .timezone_strategy(TimezoneStrategy::UseLocal)
                .max_file_size(5_000_000) // ~5 MB
                .build(),
        )
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_filter(|label| label == "main")
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // When a second instance is launched (e.g., double-clicking a .tstudio file),
            // the args are forwarded here. Open the project in a new window.
            if let Some(path) = extract_tstudio_path(&args) {
                log::info!("Single-instance: received project path {}", path);
                match create_project_window_inner(app, Some(path.clone())) {
                    Ok(label) => {
                        log::info!("Created window '{}' for project: {}", label, path);
                    }
                    Err(e) => {
                        log::error!("Failed to create window for {}: {}", path, e);
                        // Fallback: emit to all windows so the welcome screen picks it up
                        let _ = app.emit("project://open-request", serde_json::json!({ "path": path }));
                    }
                }
            } else {
                // No project path — just focus the most recent window
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_focus();
                }
            }
        }))
        .setup(|app| {
            // Store pending open path for file association launches.
            // Check CLI args for a .tstudio file (first launch via file association).
            let pending_path = extract_tstudio_path(&std::env::args().collect::<Vec<_>>());
            app.manage(PendingOpenPath(Mutex::new(pending_path)));
            app.manage(PendingWindowPaths(Mutex::new(HashMap::new())));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            project::commands::create_project,
            project::commands::save_diagram,
            project::commands::load_project,
            project::commands::save_project_config,
            project::commands::get_recent_projects,
            project::commands::remove_recent_project,
            project::commands::get_last_project_location,
            project::commands::set_last_project_location,
            project::commands::save_cost,
            project::commands::write_export_file,
            terraform::commands::write_terraform_files,
            terraform::commands::check_terraform,
            terraform::commands::terraform_init,
            terraform::commands::terraform_validate,
            terraform::commands::terraform_plan,
            terraform::commands::terraform_apply,
            terraform::commands::terraform_destroy,
            terraform::commands::terraform_plan_with_out,
            terraform::commands::terraform_apply_plan,
            terraform::commands::terraform_show,
            terraform::commands::read_terraform_file,
            terraform::commands::list_terraform_files,
            project::templates::get_user_templates_dir,
            project::templates::list_user_templates,
            project::templates::load_user_template,
            project::templates::save_user_template,
            project::templates::open_templates_folder,
            project::secrets::load_user_secrets,
            project::secrets::save_user_secrets,
            project::secrets::delete_user_secrets,
            project::secrets::generate_secrets_id,
            azure::commands::az_list_subscriptions,
            azure::commands::fetch_azure_price,
            set_log_level,
            open_log_folder,
            get_pending_open_path,
            create_project_window,
            get_window_pending_path,
            open_devtools,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Toggle the webview developer tools for the calling window.
/// DevTools APIs are only available in debug builds (Tauri auto-enables them).
#[tauri::command]
fn open_devtools(_window: tauri::WebviewWindow) {
    #[cfg(debug_assertions)]
    {
        if _window.is_devtools_open() {
            _window.close_devtools();
        } else {
            _window.open_devtools();
        }
    }
    #[cfg(not(debug_assertions))]
    {
        log::debug!("DevTools not available in release builds");
    }
}

/// Change the global log level at runtime. The `log` crate uses an atomic for
/// `max_level`, so this is safe to call from any thread at any time.
#[tauri::command]
fn set_log_level(level: String) -> Result<(), String> {
    let filter = match level.as_str() {
        "trace" => log::LevelFilter::Trace,
        "debug" => log::LevelFilter::Debug,
        "info"  => log::LevelFilter::Info,
        "warn"  => log::LevelFilter::Warn,
        "error" => log::LevelFilter::Error,
        "off"   => log::LevelFilter::Off,
        _ => return Err(format!("Invalid log level: {}", level)),
    };
    log::set_max_level(filter);
    log::info!("Log level changed to {}", level);
    Ok(())
}

/// Open the log directory in the platform file manager.
#[tauri::command]
fn open_log_folder(app_handle: tauri::AppHandle) -> Result<(), String> {
    let log_dir = app_handle
        .path()
        .app_log_dir()
        .map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&log_dir).ok();
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(log_dir.to_string_lossy().as_ref())
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&log_dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&log_dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Extract the project directory path from CLI args containing a .tstudio file.
/// Returns the parent directory of the .tstudio file (the project root).
fn extract_tstudio_path(args: &[String]) -> Option<String> {
    for arg in args.iter().skip(1) {
        // Skip flags
        if arg.starts_with('-') {
            continue;
        }
        if arg.ends_with(".tstudio") {
            let path = std::path::Path::new(arg);
            if let Some(parent) = path.parent() {
                return Some(parent.to_string_lossy().to_string());
            }
        }
    }
    None
}

/// Called by the frontend on startup to check if the app was launched via file association.
/// Returns the project directory path if one was pending, and clears it.
#[tauri::command]
fn get_pending_open_path(app_handle: tauri::AppHandle) -> Option<String> {
    let state = app_handle.state::<PendingOpenPath>();
    let result = state.0.lock().ok()?.take();
    result
}

/// Create a new project window. If a project path is provided, the new window will
/// auto-load that project on startup.
fn create_project_window_inner(
    app: &tauri::AppHandle,
    project_path: Option<String>,
) -> Result<String, String> {
    let index = WINDOW_COUNTER.fetch_add(1, Ordering::Relaxed);
    let label = format!("project-{}", index);

    if let Some(ref path) = project_path {
        let state = app.state::<PendingWindowPaths>();
        if let Ok(mut map) = state.0.lock() {
            map.insert(label.clone(), path.clone());
        }
        drop(state);
    }

    let label_clone = label.clone();
    let app_clone = app.clone();
    app.run_on_main_thread(move || {
        match WebviewWindowBuilder::new(&app_clone, &label_clone, tauri::WebviewUrl::App("index.html".into()))
            .title("TerraStudio")
            .inner_size(1400.0, 900.0)
            .min_inner_size(1024.0, 700.0)
            .decorations(false)
            .build()
        {
            Ok(w) => log::info!("New window '{}' created", w.label()),
            Err(e) => log::error!("Failed to create window '{}': {}", label_clone, e),
        }
    }).map_err(|e| format!("Failed to schedule window creation: {}", e))?;

    Ok(label)
}

/// Tauri command to create a new project window from the frontend.
#[tauri::command]
async fn create_project_window(
    app_handle: tauri::AppHandle,
    project_path: Option<String>,
) -> Result<String, String> {
    create_project_window_inner(&app_handle, project_path)
}

/// Called by each new window on startup to check if it should auto-load a project.
/// Returns the project directory path if one was pending for this window, and clears it.
#[tauri::command]
fn get_window_pending_path(window: tauri::WebviewWindow, app_handle: tauri::AppHandle) -> Option<String> {
    let label = window.label().to_string();
    let state = app_handle.state::<PendingWindowPaths>();
    let result = state.0.lock().ok()?.remove(&label);
    result
}

