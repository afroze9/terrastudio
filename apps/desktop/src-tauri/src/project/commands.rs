use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::command;

use super::recent;

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
    pub path: String,
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
            }
        }),
    };

    // Write terrastudio.json
    let metadata_path = project_dir.join("terrastudio.json");
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

/// Load a project from a directory containing terrastudio.json.
#[command]
pub async fn load_project(project_path: String) -> Result<ProjectData, String> {
    let project_dir = PathBuf::from(&project_path);

    // Read terrastudio.json
    let metadata_path = project_dir.join("terrastudio.json");
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

    // Track in recent projects
    let _ = recent::add_recent(&metadata.name, &project_path);

    Ok(ProjectData {
        metadata,
        diagram,
        path: project_path,
    })
}

/// Save project config (updates terrastudio.json).
#[command]
pub async fn save_project_config(
    project_path: String,
    project_config: serde_json::Value,
) -> Result<(), String> {
    let metadata_path = PathBuf::from(&project_path).join("terrastudio.json");

    // Read existing metadata
    let metadata_json = tokio::fs::read_to_string(&metadata_path)
        .await
        .map_err(|e| format!("Failed to read project file: {}", e))?;
    let mut metadata: ProjectMetadata = serde_json::from_str(&metadata_json)
        .map_err(|e| format!("Failed to parse project file: {}", e))?;

    metadata.project_config = project_config;

    let json = serde_json::to_string_pretty(&metadata)
        .map_err(|e| format!("Failed to serialize metadata: {}", e))?;
    tokio::fs::write(&metadata_path, &json)
        .await
        .map_err(|e| format!("Failed to write project file: {}", e))?;

    Ok(())
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
