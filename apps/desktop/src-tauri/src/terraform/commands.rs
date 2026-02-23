use std::collections::HashMap;
use std::path::PathBuf;
use tauri::{command, AppHandle};

use super::runner::{self, TerraformJsonResult};

/// Write generated .tf files to the project's terraform/ directory.
#[command]
pub async fn write_terraform_files(
    project_path: String,
    files: HashMap<String, String>,
) -> Result<String, String> {
    let terraform_dir = PathBuf::from(&project_path).join("terraform");

    tokio::fs::create_dir_all(&terraform_dir)
        .await
        .map_err(|e| format!("Failed to create terraform directory: {}", e))?;

    for (filename, content) in &files {
        let path = terraform_dir.join(filename);
        tokio::fs::write(&path, content)
            .await
            .map_err(|e| format!("Failed to write {}: {}", filename, e))?;
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
pub async fn terraform_init(app: AppHandle, project_path: String) -> Result<bool, String> {
    let terraform_dir = PathBuf::from(&project_path).join("terraform");
    let result = runner::run_terraform(&app, &terraform_dir, "init", &["-no-color"]).await?;
    Ok(result.success)
}

/// Run terraform validate.
#[command]
pub async fn terraform_validate(app: AppHandle, project_path: String) -> Result<bool, String> {
    let terraform_dir = PathBuf::from(&project_path).join("terraform");
    let result =
        runner::run_terraform(&app, &terraform_dir, "validate", &["-no-color"]).await?;
    Ok(result.success)
}

/// Run terraform plan with JSON output for structured error parsing.
#[command]
pub async fn terraform_plan(app: AppHandle, project_path: String) -> Result<TerraformJsonResult, String> {
    let terraform_dir = PathBuf::from(&project_path).join("terraform");
    runner::run_terraform_json(&app, &terraform_dir, "plan", &[]).await
}

/// Run terraform apply with auto-approve and JSON output.
#[command]
pub async fn terraform_apply(app: AppHandle, project_path: String) -> Result<TerraformJsonResult, String> {
    let terraform_dir = PathBuf::from(&project_path).join("terraform");
    runner::run_terraform_json(&app, &terraform_dir, "apply", &["-auto-approve"]).await
}

/// Run terraform destroy with auto-approve and JSON output.
#[command]
pub async fn terraform_destroy(app: AppHandle, project_path: String) -> Result<TerraformJsonResult, String> {
    let terraform_dir = PathBuf::from(&project_path).join("terraform");
    runner::run_terraform_json(&app, &terraform_dir, "destroy", &["-auto-approve"]).await
}

/// Run terraform show -json to get the current state as JSON.
#[command]
pub async fn terraform_show(project_path: String) -> Result<String, String> {
    let terraform_dir = PathBuf::from(&project_path).join("terraform");
    runner::run_terraform_capture(&terraform_dir, "show", &["-json"]).await
}

/// Read a generated terraform file's content.
#[command]
pub async fn read_terraform_file(
    project_path: String,
    filename: String,
) -> Result<String, String> {
    let file_path = PathBuf::from(&project_path).join("terraform").join(&filename);
    tokio::fs::read_to_string(&file_path)
        .await
        .map_err(|e| format!("Failed to read {}: {}", filename, e))
}

/// List .tf files in the project's terraform/ directory.
#[command]
pub async fn list_terraform_files(project_path: String) -> Result<Vec<String>, String> {
    let terraform_dir = PathBuf::from(&project_path).join("terraform");
    if !terraform_dir.exists() {
        return Ok(vec![]);
    }
    let mut files = Vec::new();
    let mut entries = tokio::fs::read_dir(&terraform_dir)
        .await
        .map_err(|e| format!("Failed to read terraform directory: {}", e))?;
    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|e| format!("Failed to read entry: {}", e))?
    {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.ends_with(".tf") || name.ends_with(".tfvars") {
            files.push(name);
        }
    }
    files.sort();
    Ok(files)
}
