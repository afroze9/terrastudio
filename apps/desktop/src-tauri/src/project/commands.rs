use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::command;

use super::recent;

const LEGACY_PROJECT_FILE: &str = "terrastudio.json";
const PROJECT_EXTENSION: &str = "tstudio";

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectMetadata {
    pub name: String,
    pub version: String,
    #[serde(rename = "projectConfig")]
    pub project_config: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectData {
    pub metadata: ProjectMetadata,
    pub diagram: Option<serde_json::Value>,
    pub cost: Option<serde_json::Value>,
    pub path: String,
}

/// Find the project file in a directory.
///
/// Looks for `*.tstudio` first (new format), falls back to `terrastudio.json` (legacy).
/// Returns the path to the project file found.
fn find_project_file(project_dir: &Path) -> Result<PathBuf, String> {
    // 1. Look for any *.tstudio file
    if let Ok(entries) = std::fs::read_dir(project_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension() {
                    if ext == PROJECT_EXTENSION {
                        return Ok(path);
                    }
                }
            }
        }
    }

    // 2. Fall back to legacy terrastudio.json
    let legacy_path = project_dir.join(LEGACY_PROJECT_FILE);
    if legacy_path.exists() {
        return Ok(legacy_path);
    }

    // 3. Neither found
    Err(format!(
        "No .{} or {} file found in {}",
        PROJECT_EXTENSION,
        LEGACY_PROJECT_FILE,
        project_dir.display()
    ))
}

/// Build the canonical project file path: `{project_dir}/{name}.tstudio`
fn project_file_path(project_dir: &Path, name: &str) -> PathBuf {
    project_dir.join(format!("{}.{}", name, PROJECT_EXTENSION))
}

/// Create a new project directory with the standard structure.
#[command]
pub async fn create_project(
    name: String,
    parent_path: String,
) -> Result<ProjectData, String> {
    let project_dir = PathBuf::from(&parent_path).join(&name);

    if project_dir.exists() {
        return Err(format!(
            "Directory already exists: {}",
            project_dir.display()
        ));
    }

    // Create directory structure
    let diagrams_dir = project_dir.join("diagrams");
    let terraform_dir = project_dir.join("terraform");

    tokio::fs::create_dir_all(&diagrams_dir)
        .await
        .map_err(|e| format!("Failed to create diagrams directory: {}", e))?;
    tokio::fs::create_dir_all(&terraform_dir)
        .await
        .map_err(|e| format!("Failed to create terraform directory: {}", e))?;

    // Create default project metadata
    let metadata = ProjectMetadata {
        name: name.clone(),
        version: "0.1.0".to_string(),
        project_config: serde_json::json!({
            "providerConfigs": {
                "azurerm": {
                    "features": {}
                }
            },
            "resourceGroupName": format!("rg-{}", name),
            "resourceGroupAsVariable": true,
            "location": "eastus",
            "locationAsVariable": true,
            "commonTags": {
                "managed_by": "terrastudio"
            },
            "variableValues": {}
        }),
    };

    // Write {name}.tstudio
    let metadata_path = project_file_path(&project_dir, &name);
    let metadata_json = serde_json::to_string_pretty(&metadata)
        .map_err(|e| format!("Failed to serialize metadata: {}", e))?;
    tokio::fs::write(&metadata_path, &metadata_json)
        .await
        .map_err(|e| format!("Failed to write project file: {}", e))?;

    let project_path_str = project_dir.to_string_lossy().to_string();

    // Track in recent projects
    let _ = recent::add_recent(&name, &project_path_str);

    Ok(ProjectData {
        metadata,
        diagram: None,
        cost: None,
        path: project_path_str,
    })
}

/// Save diagram state to the project's diagrams/main.json.
#[command]
pub async fn save_diagram(
    project_path: String,
    diagram: serde_json::Value,
) -> Result<(), String> {
    let diagram_path = PathBuf::from(&project_path)
        .join("diagrams")
        .join("main.json");

    let json = serde_json::to_string_pretty(&diagram)
        .map_err(|e| format!("Failed to serialize diagram: {}", e))?;

    tokio::fs::write(&diagram_path, &json)
        .await
        .map_err(|e| format!("Failed to write diagram: {}", e))?;

    Ok(())
}

/// Load a project from a directory containing a .tstudio file (or legacy terrastudio.json).
#[command]
pub async fn load_project(project_path: String) -> Result<ProjectData, String> {
    let project_dir = PathBuf::from(&project_path);

    // Find the project file (*.tstudio or legacy terrastudio.json)
    let metadata_path = find_project_file(&project_dir)?;
    let metadata_json = tokio::fs::read_to_string(&metadata_path)
        .await
        .map_err(|e| format!("Failed to read project file: {}", e))?;
    let metadata: ProjectMetadata = serde_json::from_str(&metadata_json)
        .map_err(|e| format!("Failed to parse project file: {}", e))?;

    // Read diagram if it exists
    let diagram_path = project_dir.join("diagrams").join("main.json");
    let diagram = if diagram_path.exists() {
        let diagram_json = tokio::fs::read_to_string(&diagram_path)
            .await
            .map_err(|e| format!("Failed to read diagram: {}", e))?;
        Some(
            serde_json::from_str(&diagram_json)
                .map_err(|e| format!("Failed to parse diagram: {}", e))?,
        )
    } else {
        None
    };

    // Read cost estimates if they exist
    let cost_path = project_dir.join("diagrams").join("cost.json");
    let cost = if cost_path.exists() {
        tokio::fs::read_to_string(&cost_path)
            .await
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
    } else {
        None
    };

    // Track in recent projects
    let _ = recent::add_recent(&metadata.name, &project_path);

    Ok(ProjectData {
        metadata,
        diagram,
        cost,
        path: project_path,
    })
}

/// Save project config — writes to `{name}.tstudio` and cleans up legacy file if present.
#[command]
pub async fn save_project_config(
    project_path: String,
    project_config: serde_json::Value,
) -> Result<(), String> {
    let project_dir = PathBuf::from(&project_path);

    // Find and read the current project file
    let current_path = find_project_file(&project_dir)?;
    let metadata_json = tokio::fs::read_to_string(&current_path)
        .await
        .map_err(|e| format!("Failed to read project file: {}", e))?;
    let mut metadata: ProjectMetadata = serde_json::from_str(&metadata_json)
        .map_err(|e| format!("Failed to parse project file: {}", e))?;

    metadata.project_config = project_config;

    // Always write to the canonical {name}.tstudio path
    let canonical_path = project_file_path(&project_dir, &metadata.name);
    let json = serde_json::to_string_pretty(&metadata)
        .map_err(|e| format!("Failed to serialize metadata: {}", e))?;
    tokio::fs::write(&canonical_path, &json)
        .await
        .map_err(|e| format!("Failed to write project file: {}", e))?;

    // If we loaded from a legacy file and it's different from the canonical path, clean it up
    if current_path != canonical_path && current_path.exists() {
        let _ = tokio::fs::remove_file(&current_path).await;
        log::info!(
            "Migrated project file: {} -> {}",
            current_path.display(),
            canonical_path.display()
        );
    }

    Ok(())
}

/// Save cost estimates to the project's diagrams/cost.json.
#[command]
pub async fn save_cost(
    project_path: String,
    cost: serde_json::Value,
) -> Result<(), String> {
    let cost_path = PathBuf::from(&project_path)
        .join("diagrams")
        .join("cost.json");

    let json = serde_json::to_string_pretty(&cost)
        .map_err(|e| format!("Failed to serialize cost: {}", e))?;

    tokio::fs::write(&cost_path, &json)
        .await
        .map_err(|e| format!("Failed to write cost: {}", e))
}

/// Write binary data to a file (used for PNG/Markdown export).
#[command]
pub async fn write_export_file(path: String, data: Vec<u8>) -> Result<(), String> {
    tokio::fs::write(&path, &data)
        .await
        .map_err(|e| format!("Failed to write export file: {}", e))
}

/// Get the list of recent projects.
#[command]
pub async fn get_recent_projects() -> Result<Vec<recent::RecentProject>, String> {
    Ok(recent::load_recent())
}

/// Remove a project from the recent projects list.
#[command]
pub async fn remove_recent_project(path: String) -> Result<(), String> {
    recent::remove_recent(&path)
}

/// Get the last used project location.
#[command]
pub async fn get_last_project_location() -> Result<Option<String>, String> {
    Ok(recent::get_last_location())
}

/// Save the last used project location.
#[command]
pub async fn set_last_project_location(location: String) -> Result<(), String> {
    recent::set_last_location(&location)
}
