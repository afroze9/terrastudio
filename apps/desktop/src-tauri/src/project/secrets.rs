use std::collections::HashMap;
use std::path::PathBuf;

const APP_DIR_NAME: &str = "com.terrastudio.app";
const SECRETS_DIR: &str = "secrets";

fn get_secrets_dir() -> Result<PathBuf, String> {
    let data_dir =
        dirs::data_dir().ok_or_else(|| "Could not determine app data directory".to_string())?;
    Ok(data_dir.join(APP_DIR_NAME).join(SECRETS_DIR))
}

fn get_secrets_path(secrets_id: &str) -> Result<PathBuf, String> {
    if secrets_id.is_empty()
        || !secrets_id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-')
    {
        return Err(format!("Invalid secrets ID: {}", secrets_id));
    }
    Ok(get_secrets_dir()?.join(format!("{}.json", secrets_id)))
}

/// Load user secrets for a project by its secrets ID.
#[tauri::command]
pub async fn load_user_secrets(secrets_id: String) -> Result<HashMap<String, String>, String> {
    let path = get_secrets_path(&secrets_id)?;
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read secrets: {}", e))?;
    serde_json::from_str(&content).map_err(|e| format!("Failed to parse secrets: {}", e))
}

/// Save user secrets for a project by its secrets ID.
#[tauri::command]
pub async fn save_user_secrets(
    secrets_id: String,
    secrets: HashMap<String, String>,
) -> Result<(), String> {
    let path = get_secrets_path(&secrets_id)?;
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create secrets directory: {}", e))?;
    }
    let json = serde_json::to_string_pretty(&secrets)
        .map_err(|e| format!("Failed to serialize secrets: {}", e))?;
    tokio::fs::write(&path, &json)
        .await
        .map_err(|e| format!("Failed to write secrets: {}", e))
}

/// Delete user secrets for a project.
#[tauri::command]
pub async fn delete_user_secrets(secrets_id: String) -> Result<(), String> {
    let path = get_secrets_path(&secrets_id)?;
    if path.exists() {
        tokio::fs::remove_file(&path)
            .await
            .map_err(|e| format!("Failed to delete secrets: {}", e))?;
    }
    Ok(())
}

/// Generate a new UUID v4 secrets ID.
#[tauri::command]
pub fn generate_secrets_id() -> String {
    uuid::Uuid::new_v4().to_string()
}
