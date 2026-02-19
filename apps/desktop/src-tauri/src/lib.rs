mod project;
mod terraform;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            project::commands::create_project,
            project::commands::save_diagram,
            project::commands::load_project,
            project::commands::save_project_config,
            project::commands::get_recent_projects,
            project::commands::remove_recent_project,
            project::commands::write_export_file,
            terraform::commands::write_terraform_files,
            terraform::commands::check_terraform,
            terraform::commands::terraform_init,
            terraform::commands::terraform_validate,
            terraform::commands::terraform_plan,
            terraform::commands::terraform_apply,
            terraform::commands::terraform_destroy,
            terraform::commands::terraform_show,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
