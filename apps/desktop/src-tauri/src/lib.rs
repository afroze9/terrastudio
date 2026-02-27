use tauri::{Emitter, Manager};
use tauri_plugin_log::{Target, TargetKind, RotationStrategy, TimezoneStrategy};

mod azure;
mod mcp;
mod project;
mod terraform;

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
                .rotation_strategy(RotationStrategy::KeepAll)
                .timezone_strategy(TimezoneStrategy::UseLocal)
                .max_file_size(5_000_000) // ~5 MB
                .build(),
        )
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // Initialize MCP state for diagram cache.
            // MCP bridge + sidecar are started lazily from the frontend via
            // the `mcp_start` command — not here — so the UI is never blocked.
            app.manage(mcp::commands::McpState::new());

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
            terraform::commands::terraform_show,
            terraform::commands::read_terraform_file,
            terraform::commands::list_terraform_files,
            project::templates::get_user_templates_dir,
            project::templates::list_user_templates,
            project::templates::load_user_template,
            project::templates::save_user_template,
            project::templates::open_templates_folder,
            azure::commands::az_list_subscriptions,
            azure::commands::fetch_azure_price,
            mcp::commands::mcp_sync_diagram,
            mcp::commands::mcp_sync_resource_types,
            mcp::commands::mcp_sync_hcl_files,
            mcp_start,
            set_log_level,
            open_log_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
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

/// Frontend calls this once the UI is interactive. Starts the IPC bridge + Node sidecar
/// on a background task so the webview is never blocked.
#[tauri::command]
async fn mcp_start(app_handle: tauri::AppHandle) -> Result<(), String> {
    let app = app_handle.clone();
    tauri::async_runtime::spawn(async move {
        match mcp::server::IpcBridgeServer::start(app.clone()).await {
            Ok(bridge) => {
                let ipc_port = bridge.port();
                log::info!("MCP IPC bridge started on port {}", ipc_port);
                app.manage(bridge);

                let _ = app.emit("mcp:status_changed", serde_json::json!({
                    "status": "starting",
                    "ipcPort": ipc_port,
                }));

                spawn_mcp_sidecar(&app, ipc_port).await;
            }
            Err(e) => {
                log::error!("Failed to start MCP IPC bridge: {}", e);
                let _ = app.emit("mcp:status_changed", serde_json::json!({
                    "status": "error",
                    "error": format!("Failed to start IPC bridge: {}", e),
                }));
            }
        }
    });
    Ok(())
}

/// Spawn the MCP sidecar Node.js process with auto-restart (up to 3 attempts).
async fn spawn_mcp_sidecar(app_handle: &tauri::AppHandle, ipc_port: u16) {
    // Resolve path to the bundled mcp-server.js
    let resource_dir = app_handle
        .path()
        .resource_dir()
        .unwrap_or_default();

    // In dev mode, use the workspace build output; in production, use bundled resource
    let mcp_server_path = if cfg!(debug_assertions) {
        // Dev: relative to the Tauri project root
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../../packages/mcp-server/dist/mcp-server.js")
    } else {
        resource_dir.join("mcp-server.js")
    };

    let mcp_server_str = mcp_server_path.to_string_lossy().to_string();

    if !mcp_server_path.exists() {
        log::warn!("MCP server not found at {:?}, skipping sidecar launch", mcp_server_path);
        let _ = app_handle.emit("mcp:status_changed", serde_json::json!({
            "status": "disabled",
            "error": "MCP server binary not found",
        }));
        return;
    }

    // Write MCP manifest for client auto-discovery
    let _ = mcp::manifest::write_mcp_manifest(&mcp_server_str, ipc_port).await;

    let max_restarts = 3;
    let app_clone = app_handle.clone();

    for attempt in 0..=max_restarts {
        if attempt > 0 {
            log::info!("MCP sidecar restart attempt {}/{}", attempt, max_restarts);
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
        }

        log::info!("Launching MCP sidecar: node {}", mcp_server_str);
        let result = tokio::process::Command::new("node")
            .arg(&mcp_server_str)
            .env("TERRASTUDIO_IPC_PORT", ipc_port.to_string())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn();

        match result {
            Ok(mut child) => {
                let _ = app_clone.emit("mcp:status_changed", serde_json::json!({
                    "status": "listening",
                }));

                // Log stderr output
                if let Some(stderr) = child.stderr.take() {
                    let app_for_log = app_clone.clone();
                    tokio::spawn(async move {
                        use tokio::io::{AsyncBufReadExt, BufReader};
                        let mut reader = BufReader::new(stderr).lines();
                        while let Ok(Some(line)) = reader.next_line().await {
                            log::info!("[mcp-sidecar] {}", line);
                            // If line contains port info, emit it
                            if line.contains("HTTP transport listening") {
                                let _ = app_for_log.emit("mcp:status_changed", serde_json::json!({
                                    "status": "listening",
                                }));
                            }
                        }
                    });
                }

                // Wait for the process to exit
                match child.wait().await {
                    Ok(status) => {
                        log::warn!("MCP sidecar exited with status: {}", status);
                        let _ = app_clone.emit("mcp:status_changed", serde_json::json!({
                            "status": "error",
                            "error": format!("Sidecar exited with code {}", status),
                        }));
                    }
                    Err(e) => {
                        log::error!("MCP sidecar error: {}", e);
                        let _ = app_clone.emit("mcp:status_changed", serde_json::json!({
                            "status": "error",
                            "error": format!("Sidecar error: {}", e),
                        }));
                    }
                }
            }
            Err(e) => {
                log::error!("Failed to spawn MCP sidecar: {}", e);
                let _ = app_clone.emit("mcp:status_changed", serde_json::json!({
                    "status": "error",
                    "error": format!("Failed to spawn: {}", e),
                }));
            }
        }
    }

    log::error!("MCP sidecar failed after {} restart attempts", max_restarts);
    let _ = app_clone.emit("mcp:status_changed", serde_json::json!({
        "status": "error",
        "error": "Sidecar failed after maximum restart attempts",
    }));
}
