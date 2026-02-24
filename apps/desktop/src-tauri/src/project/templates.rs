use serde::Serialize;
use std::path::PathBuf;

const APP_DIR_NAME: &str = "com.terrastudio.app";
const TEMPLATES_DIR: &str = "templates";

#[derive(Debug, Clone, Serialize)]
pub struct UserTemplateEntry {
    pub category: String,
    pub filename: String,
    pub path: String,
}

fn get_templates_dir() -> Result<PathBuf, String> {
    let data_dir =
        dirs::data_dir().ok_or_else(|| "Could not determine app data directory".to_string())?;
    Ok(data_dir.join(APP_DIR_NAME).join(TEMPLATES_DIR))
}

#[tauri::command]
pub async fn get_user_templates_dir() -> Result<String, String> {
    let dir = get_templates_dir()?;
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create templates directory: {}", e))?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn list_user_templates() -> Result<Vec<UserTemplateEntry>, String> {
    let dir = get_templates_dir()?;

    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut entries = Vec::new();

    // Walk {templates_dir}/{category}/*.json
    let categories =
        std::fs::read_dir(&dir).map_err(|e| format!("Failed to read templates dir: {}", e))?;

    for cat_entry in categories {
        let cat_entry = match cat_entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        let cat_path = cat_entry.path();
        if !cat_path.is_dir() {
            continue;
        }

        let category = cat_entry
            .file_name()
            .to_string_lossy()
            .to_string();

        let files = match std::fs::read_dir(&cat_path) {
            Ok(f) => f,
            Err(_) => continue,
        };

        for file_entry in files {
            let file_entry = match file_entry {
                Ok(e) => e,
                Err(_) => continue,
            };

            let file_path = file_entry.path();
            if file_path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }

            let filename = file_entry.file_name().to_string_lossy().to_string();

            entries.push(UserTemplateEntry {
                category: category.clone(),
                filename,
                path: file_path.to_string_lossy().to_string(),
            });
        }
    }

    Ok(entries)
}

#[tauri::command]
pub async fn open_templates_folder() -> Result<(), String> {
    let dir = get_templates_dir()?;
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create templates directory: {}", e))?;

    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer")
        .arg(&dir)
        .spawn()
        .map_err(|e| format!("Failed to open folder: {}", e))?;

    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .arg(&dir)
        .spawn()
        .map_err(|e| format!("Failed to open folder: {}", e))?;

    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open")
        .arg(&dir)
        .spawn()
        .map_err(|e| format!("Failed to open folder: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn load_user_template(path: String) -> Result<serde_json::Value, String> {
    let content =
        std::fs::read_to_string(&path).map_err(|e| format!("Failed to read template: {}", e))?;

    serde_json::from_str(&content).map_err(|e| format!("Failed to parse template JSON: {}", e))
}

#[tauri::command]
pub async fn save_user_template(
    category: String,
    id: String,
    json: String,
) -> Result<(), String> {
    // Validate id — only lowercase alphanumeric, hyphens, underscores
    if id.is_empty()
        || !id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err(format!(
            "Invalid template id '{}': use only letters, numbers, hyphens and underscores",
            id
        ));
    }

    let dir = get_templates_dir()?.join(&category);
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create template directory: {}", e))?;

    let path = dir.join(format!("{}.json", id));
    std::fs::write(&path, &json)
        .map_err(|e| format!("Failed to write template file: {}", e))?;

    Ok(())
}
