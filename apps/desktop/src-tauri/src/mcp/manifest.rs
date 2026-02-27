use serde_json::json;
use std::path::PathBuf;

/// Generate an MCP manifest JSON for Claude Desktop / VS Code auto-discovery.
/// The manifest tells MCP clients how to connect to TerraStudio's MCP server.
pub fn generate_mcp_manifest(mcp_server_path: &str, ipc_port: u16) -> serde_json::Value {
    json!({
        "mcpServers": {
            "terrastudio": {
                "command": "node",
                "args": [mcp_server_path],
                "env": {
                    "TERRASTUDIO_IPC_PORT": ipc_port.to_string()
                }
            }
        }
    })
}

/// Write the MCP manifest to the app config directory.
/// Returns the path where the manifest was written.
pub async fn write_mcp_manifest(
    mcp_server_path: &str,
    ipc_port: u16,
) -> Result<PathBuf, String> {
    let config_dir = dirs::config_dir()
        .ok_or("Could not determine config directory")?
        .join("terrastudio");

    tokio::fs::create_dir_all(&config_dir)
        .await
        .map_err(|e| format!("Failed to create config dir: {}", e))?;

    let manifest_path = config_dir.join("mcp.json");
    let manifest = generate_mcp_manifest(mcp_server_path, ipc_port);
    let json_str = serde_json::to_string_pretty(&manifest)
        .map_err(|e| format!("Failed to serialize manifest: {}", e))?;

    tokio::fs::write(&manifest_path, json_str)
        .await
        .map_err(|e| format!("Failed to write manifest: {}", e))?;

    log::info!("MCP manifest written to {:?}", manifest_path);
    Ok(manifest_path)
}
