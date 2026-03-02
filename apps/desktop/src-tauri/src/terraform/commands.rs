use std::collections::HashMap;
use std::path::PathBuf;
use tauri::{command, AppHandle, WebviewWindow};

use super::runner::{self, TerraformJsonResult};
use crate::security;

/// Write generated .tf files to the project's terraform/ directory.
/// Supports subdirectory paths (e.g., "modules/net/main.tf") for module output.
#[command]
pub async fn write_terraform_files(
    project_path: String,
    files: HashMap<String, String>,
) -> Result<String, String> {
    let terraform_dir = PathBuf::from(&project_path).join("terraform");

    // Validate all file paths before writing any files
    for filepath in files.keys() {
        security::sanitize_filepath(filepath)
            .map_err(|e| format!("Invalid terraform file path: {}", e))?;
    }

    tokio::fs::create_dir_all(&terraform_dir)
        .await
        .map_err(|e| format!("Failed to create terraform directory: {}", e))?;

    for (filepath, content) in &files {
        let path = terraform_dir.join(filepath);
        // Create subdirectories if the path contains them (e.g., modules/net/)
        if let Some(parent) = path.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| format!("Failed to create directory for {}: {}", filepath, e))?;
        }
        tokio::fs::write(&path, content)
            .await
            .map_err(|e| format!("Failed to write {}: {}", filepath, e))?;
    }

    Ok(terraform_dir.to_string_lossy().to_string())
}

/// Check if terraform is installed and return version string.
#[command]
pub async fn check_terraform() -> Result<String, String> {
    runner::check_terraform_installed().await
}

/// Run terraform init in the project's terraform/ directory.
#[command]
pub async fn terraform_init(app: AppHandle, window: WebviewWindow, project_path: String) -> Result<bool, String> {
    let terraform_dir = PathBuf::from(&project_path).join("terraform");
    let result = runner::run_terraform(&app, window.label(), &terraform_dir, "init", &["-no-color"]).await?;
    Ok(result.success)
}

/// Run terraform validate.
#[command]
pub async fn terraform_validate(app: AppHandle, window: WebviewWindow, project_path: String) -> Result<bool, String> {
    let terraform_dir = PathBuf::from(&project_path).join("terraform");
    let result =
        runner::run_terraform(&app, window.label(), &terraform_dir, "validate", &["-no-color"]).await?;
    Ok(result.success)
}

/// Run terraform plan with JSON output for structured error parsing.
#[command]
pub async fn terraform_plan(app: AppHandle, window: WebviewWindow, project_path: String) -> Result<TerraformJsonResult, String> {
    let terraform_dir = PathBuf::from(&project_path).join("terraform");
    runner::run_terraform_json(&app, window.label(), &terraform_dir, "plan", &[]).await
}

/// Run terraform apply with auto-approve and JSON output.
#[command]
pub async fn terraform_apply(app: AppHandle, window: WebviewWindow, project_path: String) -> Result<TerraformJsonResult, String> {
    let terraform_dir = PathBuf::from(&project_path).join("terraform");
    runner::run_terraform_json(&app, window.label(), &terraform_dir, "apply", &["-auto-approve"]).await
}

/// Run terraform destroy with auto-approve and JSON output.
#[command]
pub async fn terraform_destroy(app: AppHandle, window: WebviewWindow, project_path: String) -> Result<TerraformJsonResult, String> {
    let terraform_dir = PathBuf::from(&project_path).join("terraform");
    runner::run_terraform_json(&app, window.label(), &terraform_dir, "destroy", &["-auto-approve"]).await
}

/// Run terraform show -json to get the current state as JSON.
#[command]
pub async fn terraform_show(project_path: String) -> Result<String, String> {
    let terraform_dir = PathBuf::from(&project_path).join("terraform");
    runner::run_terraform_capture(&terraform_dir, "show", &["-json"]).await
}

/// Read a generated terraform file's content.
/// Supports subdirectory paths (e.g., "modules/net/main.tf").
#[command]
pub async fn read_terraform_file(
    project_path: String,
    filename: String,
) -> Result<String, String> {
    let safe_path = security::sanitize_filepath(&filename)
        .map_err(|e| format!("Invalid file path: {}", e))?;
    let file_path = PathBuf::from(&project_path).join("terraform").join(safe_path);
    tokio::fs::read_to_string(&file_path)
        .await
        .map_err(|e| format!("Failed to read {}: {}", filename, e))
}

/// List .tf files in the project's terraform/ directory, including subdirectories.
/// Returns relative paths (e.g., "main.tf", "modules/net/main.tf").
#[command]
pub async fn list_terraform_files(project_path: String) -> Result<Vec<String>, String> {
    let terraform_dir = PathBuf::from(&project_path).join("terraform");
    if !terraform_dir.exists() {
        return Ok(vec![]);
    }
    let mut files = Vec::new();
    list_tf_files_recursive(&terraform_dir, &terraform_dir, &mut files).await?;
    files.sort();
    Ok(files)
}

/// Recursively list .tf files, returning paths relative to the base directory.
async fn list_tf_files_recursive(
    base: &PathBuf,
    dir: &PathBuf,
    files: &mut Vec<String>,
) -> Result<(), String> {
    let mut entries = tokio::fs::read_dir(dir)
        .await
        .map_err(|e| format!("Failed to read directory {}: {}", dir.display(), e))?;
    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|e| format!("Failed to read entry: {}", e))?
    {
        let path = entry.path();
        if path.is_dir() {
            // Skip .terraform directory
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') {
                continue;
            }
            Box::pin(list_tf_files_recursive(base, &path, files)).await?;
        } else {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.ends_with(".tf") || name.ends_with(".tfvars") || name.ends_with(".tfvars.example") {
                // Return path relative to base terraform dir
                let relative = path.strip_prefix(base)
                    .map_err(|e| format!("Failed to compute relative path: {}", e))?;
                // Use forward slashes for consistency
                let relative_str = relative.to_string_lossy().replace('\\', "/");
                files.push(relative_str);
            }
        }
    }
    Ok(())
}
