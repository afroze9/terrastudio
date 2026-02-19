use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

const MAX_RECENT: usize = 10;
const APP_DIR_NAME: &str = "com.terrastudio.app";
const RECENT_FILE: &str = "recent-projects.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentProject {
    pub name: String,
    pub path: String,
    pub opened_at: u64, // epoch milliseconds
}

fn get_recent_projects_path() -> Result<PathBuf, String> {
    let data_dir = dirs::data_dir()
        .ok_or_else(|| "Could not determine app data directory".to_string())?;
    Ok(data_dir.join(APP_DIR_NAME).join(RECENT_FILE))
}

pub fn load_recent() -> Vec<RecentProject> {
    let path = match get_recent_projects_path() {
        Ok(p) => p,
        Err(_) => return Vec::new(),
    };

    let json = match std::fs::read_to_string(&path) {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };

    serde_json::from_str(&json).unwrap_or_default()
}

fn save_recent(projects: &[RecentProject]) -> Result<(), String> {
    let path = get_recent_projects_path()?;

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create app data directory: {}", e))?;
    }

    let json = serde_json::to_string_pretty(projects)
        .map_err(|e| format!("Failed to serialize recent projects: {}", e))?;

    std::fs::write(&path, &json)
        .map_err(|e| format!("Failed to write recent projects: {}", e))?;

    Ok(())
}

pub fn add_recent(name: &str, path: &str) -> Result<(), String> {
    let mut projects = load_recent();

    // Remove existing entry with the same path
    projects.retain(|p| p.path != path);

    // Prepend new entry
    projects.insert(
        0,
        RecentProject {
            name: name.to_string(),
            path: path.to_string(),
            opened_at: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
        },
    );

    // Cap at MAX_RECENT
    projects.truncate(MAX_RECENT);

    save_recent(&projects)
}

pub fn remove_recent(path: &str) -> Result<(), String> {
    let mut projects = load_recent();
    projects.retain(|p| p.path != path);
    save_recent(&projects)
}
