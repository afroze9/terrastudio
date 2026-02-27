use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::{Mutex, RwLock};

use super::types::BridgeResponse;

/// Shared MCP state managed by Tauri.
/// Stores cached diagram snapshots and resource type info for the bridge to query.
pub struct McpState {
    pub diagram_cache: RwLock<Option<Value>>,
    pub resource_types_cache: RwLock<Value>,
    /// Cached HCL files from last generation (filename → content)
    pub hcl_cache: RwLock<Option<Value>>,
    /// Notify channel: fires when frontend syncs HCL files after generation
    hcl_notify: tokio::sync::Notify,
    /// Serializes all write operations to prevent race conditions
    write_lock: Mutex<()>,
}

impl McpState {
    pub fn new() -> Self {
        Self {
            diagram_cache: RwLock::new(None),
            resource_types_cache: RwLock::new(json!([])),
            hcl_cache: RwLock::new(None),
            hcl_notify: tokio::sync::Notify::new(),
            write_lock: Mutex::new(()),
        }
    }
}

// ── Tauri commands (called from frontend to push data into cache) ──────────

#[tauri::command]
pub async fn mcp_sync_diagram(
    nodes: Value,
    edges: Value,
    state: State<'_, McpState>,
) -> Result<(), String> {
    let snapshot = json!({ "nodes": nodes, "edges": edges });
    *state.diagram_cache.write().await = Some(snapshot);
    Ok(())
}

#[tauri::command]
pub async fn mcp_sync_resource_types(
    types: Value,
    state: State<'_, McpState>,
) -> Result<(), String> {
    *state.resource_types_cache.write().await = types;
    Ok(())
}

#[tauri::command]
pub async fn mcp_sync_hcl_files(
    files: Value,
    state: State<'_, McpState>,
) -> Result<(), String> {
    *state.hcl_cache.write().await = Some(files);
    state.hcl_notify.notify_waiters();
    Ok(())
}

// ── Bridge command dispatcher (called from WebSocket handler) ──────────────

/// Dispatch a bridge command from the sidecar and return a response.
pub async fn dispatch_bridge_command(
    command: &str,
    params: Value,
    app_handle: &AppHandle,
) -> BridgeResponse {
    let id = String::new(); // caller sets the actual id

    // Get McpState — it's managed by Tauri
    let state = match app_handle.try_state::<McpState>() {
        Some(s) => s,
        None => {
            return BridgeResponse::error(
                id,
                "INTERNAL_ERROR",
                "McpState not initialized",
            );
        }
    };

    match command {
        // ── Read commands ──
        "mcp_get_diagram_snapshot" => {
            let cache = state.diagram_cache.read().await;
            match cache.as_ref() {
                Some(snapshot) => BridgeResponse::success(id, snapshot.clone()),
                None => BridgeResponse::success(id, json!({ "nodes": [], "edges": [] })),
            }
        }

        "mcp_get_resource_types" => {
            let types = state.resource_types_cache.read().await;
            BridgeResponse::success(id, types.clone())
        }

        // ── Write commands (resource mutations) ──
        "mcp_add_resource" => {
            let _guard = state.write_lock.lock().await;
            handle_add_resource(params, &state, app_handle).await
        }

        "mcp_update_resource" => {
            let _guard = state.write_lock.lock().await;
            handle_update_resource(params, &state, app_handle).await
        }

        "mcp_remove_resource" => {
            let _guard = state.write_lock.lock().await;
            handle_remove_resource(params, &state, app_handle).await
        }

        "mcp_connect_resources" => {
            let _guard = state.write_lock.lock().await;
            handle_connect_resources(params, &state, app_handle).await
        }

        "mcp_disconnect_resources" => {
            let _guard = state.write_lock.lock().await;
            handle_disconnect_resources(params, &state, app_handle).await
        }

        // ── Project/Terraform commands (delegated to frontend via events) ──
        "mcp_save_project" => {
            emit_and_ok(app_handle, "mcp:save_project", json!({}))
        }

        "mcp_generate_hcl" => {
            handle_generate_hcl(app_handle).await
        }

        "mcp_get_hcl_files" => {
            let cache = state.hcl_cache.read().await;
            match cache.as_ref() {
                Some(files) => BridgeResponse::success(String::new(), files.clone()),
                None => BridgeResponse::success(String::new(), json!({})),
            }
        }

        "mcp_run_terraform" => {
            let command_name = params.get("command").and_then(|c| c.as_str()).unwrap_or("");
            emit_and_ok(app_handle, "mcp:run_terraform", json!({ "command": command_name }))
        }

        "mcp_open_project" => {
            let path = params.get("projectPath").and_then(|p| p.as_str()).unwrap_or("");
            emit_and_ok(app_handle, "mcp:open_project", json!({ "projectPath": path }))
        }

        "mcp_new_project" => {
            emit_and_ok(app_handle, "mcp:new_project", params)
        }

        "mcp_get_project_config" => {
            // Delegate to frontend which has the config store
            emit_and_ok(app_handle, "mcp:get_project_config", json!({}))
        }

        "mcp_set_project_config" => {
            emit_and_ok(app_handle, "mcp:set_project_config", params)
        }

        "mcp_get_deployment_status" => {
            // Extract deployment status from cached diagram nodes
            let cache = state.diagram_cache.read().await;
            match cache.as_ref() {
                Some(snapshot) => {
                    let nodes = snapshot.get("nodes").and_then(|n| n.as_array());
                    let mut status_map = serde_json::Map::new();
                    if let Some(nodes) = nodes {
                        for node in nodes {
                            if let (Some(id), Some(data)) = (
                                node.get("id").and_then(|i| i.as_str()),
                                node.get("data"),
                            ) {
                                let deploy_status = data
                                    .get("deploymentStatus")
                                    .cloned()
                                    .unwrap_or(json!("pending"));
                                status_map.insert(id.to_string(), deploy_status);
                            }
                        }
                    }
                    BridgeResponse::success(id, Value::Object(status_map))
                }
                None => BridgeResponse::success(id, json!({})),
            }
        }

        _ => BridgeResponse::error(
            id,
            "UNKNOWN_COMMAND",
            format!("Unknown bridge command: {}", command),
        ),
    }
}

// ── Mutation handlers ──────────────────────────────────────────────────────

async fn handle_add_resource(
    params: Value,
    state: &McpState,
    app_handle: &AppHandle,
) -> BridgeResponse {
    let id = String::new();

    let type_id = match params.get("typeId").and_then(|t| t.as_str()) {
        Some(t) => t.to_string(),
        None => return BridgeResponse::error(id, "VALIDATION_ERROR", "typeId is required"),
    };

    // Validate typeId exists in resource types cache
    {
        let types = state.resource_types_cache.read().await;
        let type_exists = types
            .as_array()
            .map(|arr| arr.iter().any(|t| t.get("typeId").and_then(|i| i.as_str()) == Some(&type_id)))
            .unwrap_or(false);

        if !type_exists {
            // Find suggestions via substring match
            let suggestions: Vec<String> = types
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|t| t.get("typeId").and_then(|i| i.as_str()).map(String::from))
                        .filter(|tid| {
                            let needle = type_id.to_lowercase();
                            tid.to_lowercase().contains(&needle)
                                || needle.split('/').any(|seg| tid.to_lowercase().contains(seg))
                        })
                        .take(5)
                        .collect()
                })
                .unwrap_or_default();

            return BridgeResponse::error_with_details(
                id,
                "NOT_FOUND",
                format!("Unknown resource type: {}", type_id),
                json!({ "suggestions": suggestions }),
            );
        }
    }

    // Validate parentId if provided
    let parent_id = params.get("parentId").and_then(|p| p.as_str()).map(String::from);
    if let Some(ref pid) = parent_id {
        let cache = state.diagram_cache.read().await;
        if let Some(snapshot) = cache.as_ref() {
            let parent_exists = snapshot
                .get("nodes")
                .and_then(|n| n.as_array())
                .map(|nodes| nodes.iter().any(|n| n.get("id").and_then(|i| i.as_str()) == Some(pid)))
                .unwrap_or(false);

            if !parent_exists {
                return BridgeResponse::error(
                    id,
                    "VALIDATION_ERROR",
                    format!("Parent node not found: {}", pid),
                );
            }
        }
    }

    // Generate instance ID and terraform name
    let instance_id = uuid::Uuid::new_v4().to_string();
    let tf_name = generate_terraform_name(&type_id);

    // Determine position
    let position = if let Some(pos) = params.get("position") {
        pos.clone()
    } else {
        auto_position(state).await
    };

    let properties = params.get("properties").cloned().unwrap_or(json!({}));

    // Build node data matching ResourceNodeData shape
    let node_data = json!({
        "typeId": type_id,
        "label": get_display_name(&type_id),
        "terraformName": tf_name,
        "properties": properties,
        "references": {},
        "validationErrors": [],
        "deploymentStatus": "pending",
        "enabledOutputs": [],
    });

    let mut node = json!({
        "id": instance_id,
        "type": type_id,
        "position": position,
        "data": node_data,
    });

    if let Some(ref pid) = parent_id {
        node["parentId"] = json!(pid);
        node["extent"] = json!("parent");
    }

    // Emit mutation event to frontend
    let mutation = json!({
        "op": "add_node",
        "payload": node,
    });
    if let Err(e) = app_handle.emit("diagram:mcp_mutated", &mutation) {
        return BridgeResponse::error(id, "INTERNAL_ERROR", format!("Failed to emit event: {}", e));
    }

    // Update cache
    {
        let mut cache = state.diagram_cache.write().await;
        if let Some(ref mut snapshot) = *cache {
            if let Some(nodes) = snapshot.get_mut("nodes").and_then(|n| n.as_array_mut()) {
                nodes.push(node);
            }
        }
    }

    BridgeResponse::success(
        id,
        json!({
            "instanceId": instance_id,
            "terraformName": tf_name,
            "position": position,
        }),
    )
}

async fn handle_update_resource(
    params: Value,
    state: &McpState,
    app_handle: &AppHandle,
) -> BridgeResponse {
    let id = String::new();

    let instance_id = match params.get("instanceId").and_then(|i| i.as_str()) {
        Some(i) => i.to_string(),
        None => return BridgeResponse::error(id, "VALIDATION_ERROR", "instanceId is required"),
    };

    let properties = match params.get("properties") {
        Some(p) => p.clone(),
        None => return BridgeResponse::error(id, "VALIDATION_ERROR", "properties is required"),
    };

    // Validate node exists
    {
        let cache = state.diagram_cache.read().await;
        if !node_exists_in_cache(&cache, &instance_id) {
            return BridgeResponse::error(
                id,
                "NOT_FOUND",
                format!("Resource not found: {}", instance_id),
            );
        }
    }

    // Emit mutation
    let mutation = json!({
        "op": "update_node_data",
        "instanceId": instance_id,
        "data": { "properties": properties },
    });
    if let Err(e) = app_handle.emit("diagram:mcp_mutated", &mutation) {
        return BridgeResponse::error(id, "INTERNAL_ERROR", format!("Failed to emit event: {}", e));
    }

    // Update cache
    {
        let mut cache = state.diagram_cache.write().await;
        if let Some(ref mut snapshot) = *cache {
            if let Some(nodes) = snapshot.get_mut("nodes").and_then(|n| n.as_array_mut()) {
                for node in nodes.iter_mut() {
                    if node.get("id").and_then(|i| i.as_str()) == Some(&instance_id) {
                        if let Some(data) = node.get_mut("data") {
                            if let Some(existing_props) = data.get_mut("properties") {
                                if let (Some(existing_obj), Some(new_obj)) =
                                    (existing_props.as_object_mut(), properties.as_object())
                                {
                                    for (k, v) in new_obj {
                                        existing_obj.insert(k.clone(), v.clone());
                                    }
                                }
                            }
                        }
                        break;
                    }
                }
            }
        }
    }

    BridgeResponse::success(id, json!({}))
}

async fn handle_remove_resource(
    params: Value,
    state: &McpState,
    app_handle: &AppHandle,
) -> BridgeResponse {
    let id = String::new();

    let instance_id = match params.get("instanceId").and_then(|i| i.as_str()) {
        Some(i) => i.to_string(),
        None => return BridgeResponse::error(id, "VALIDATION_ERROR", "instanceId is required"),
    };

    // Validate node exists
    {
        let cache = state.diagram_cache.read().await;
        if !node_exists_in_cache(&cache, &instance_id) {
            return BridgeResponse::error(
                id,
                "NOT_FOUND",
                format!("Resource not found: {}", instance_id),
            );
        }
    }

    // Emit mutation — frontend handles cascade removal of children
    let mutation = json!({
        "op": "remove_node",
        "instanceId": instance_id,
    });
    if let Err(e) = app_handle.emit("diagram:mcp_mutated", &mutation) {
        return BridgeResponse::error(id, "INTERNAL_ERROR", format!("Failed to emit event: {}", e));
    }

    // Update cache — remove node and connected edges
    {
        let mut cache = state.diagram_cache.write().await;
        if let Some(ref mut snapshot) = *cache {
            // Collect node + descendants
            let mut to_remove = vec![instance_id.clone()];
            if let Some(nodes) = snapshot.get("nodes").and_then(|n| n.as_array()) {
                let mut changed = true;
                while changed {
                    changed = false;
                    for node in nodes {
                        let nid = node.get("id").and_then(|i| i.as_str()).unwrap_or("");
                        let pid = node.get("parentId").and_then(|p| p.as_str()).unwrap_or("");
                        if !to_remove.contains(&nid.to_string()) && to_remove.contains(&pid.to_string()) {
                            to_remove.push(nid.to_string());
                            changed = true;
                        }
                    }
                }
            }

            if let Some(nodes) = snapshot.get_mut("nodes").and_then(|n| n.as_array_mut()) {
                nodes.retain(|n| {
                    n.get("id")
                        .and_then(|i| i.as_str())
                        .map(|nid| !to_remove.contains(&nid.to_string()))
                        .unwrap_or(true)
                });
            }
            if let Some(edges) = snapshot.get_mut("edges").and_then(|e| e.as_array_mut()) {
                edges.retain(|e| {
                    let src = e.get("source").and_then(|s| s.as_str()).unwrap_or("");
                    let tgt = e.get("target").and_then(|t| t.as_str()).unwrap_or("");
                    !to_remove.contains(&src.to_string()) && !to_remove.contains(&tgt.to_string())
                });
            }
        }
    }

    BridgeResponse::success(id, json!({}))
}

async fn handle_connect_resources(
    params: Value,
    state: &McpState,
    app_handle: &AppHandle,
) -> BridgeResponse {
    let id = String::new();

    let source_id = match params.get("sourceInstanceId").and_then(|s| s.as_str()) {
        Some(s) => s.to_string(),
        None => return BridgeResponse::error(id, "VALIDATION_ERROR", "sourceInstanceId is required"),
    };
    let source_handle = match params.get("sourceHandle").and_then(|s| s.as_str()) {
        Some(s) => s.to_string(),
        None => return BridgeResponse::error(id, "VALIDATION_ERROR", "sourceHandle is required"),
    };
    let target_id = match params.get("targetInstanceId").and_then(|t| t.as_str()) {
        Some(t) => t.to_string(),
        None => return BridgeResponse::error(id, "VALIDATION_ERROR", "targetInstanceId is required"),
    };
    let target_handle = match params.get("targetHandle").and_then(|t| t.as_str()) {
        Some(t) => t.to_string(),
        None => return BridgeResponse::error(id, "VALIDATION_ERROR", "targetHandle is required"),
    };

    // Validate both nodes exist
    {
        let cache = state.diagram_cache.read().await;
        if !node_exists_in_cache(&cache, &source_id) {
            return BridgeResponse::error(id, "NOT_FOUND", format!("Source resource not found: {}", source_id));
        }
        if !node_exists_in_cache(&cache, &target_id) {
            return BridgeResponse::error(id, "NOT_FOUND", format!("Target resource not found: {}", target_id));
        }
    }

    let edge_id = format!("e-{}-{}-{}", source_id, source_handle, target_id);

    let edge = json!({
        "id": edge_id,
        "source": source_id,
        "target": target_id,
        "sourceHandle": source_handle,
        "targetHandle": target_handle,
        "data": { "category": "structural" },
    });

    // Emit mutation
    let mutation = json!({
        "op": "add_edge",
        "payload": edge,
    });
    if let Err(e) = app_handle.emit("diagram:mcp_mutated", &mutation) {
        return BridgeResponse::error(id, "INTERNAL_ERROR", format!("Failed to emit event: {}", e));
    }

    // Update cache
    {
        let mut cache = state.diagram_cache.write().await;
        if let Some(ref mut snapshot) = *cache {
            if let Some(edges) = snapshot.get_mut("edges").and_then(|e| e.as_array_mut()) {
                edges.push(edge);
            }
        }
    }

    BridgeResponse::success(id, json!({ "edgeId": edge_id }))
}

async fn handle_disconnect_resources(
    params: Value,
    state: &McpState,
    app_handle: &AppHandle,
) -> BridgeResponse {
    let id = String::new();

    let edge_id = match params.get("edgeId").and_then(|e| e.as_str()) {
        Some(e) => e.to_string(),
        None => return BridgeResponse::error(id, "VALIDATION_ERROR", "edgeId is required"),
    };

    // Validate edge exists
    {
        let cache = state.diagram_cache.read().await;
        let exists = cache
            .as_ref()
            .and_then(|s| s.get("edges"))
            .and_then(|e| e.as_array())
            .map(|edges| edges.iter().any(|e| e.get("id").and_then(|i| i.as_str()) == Some(&edge_id)))
            .unwrap_or(false);

        if !exists {
            return BridgeResponse::error(id, "NOT_FOUND", format!("Edge not found: {}", edge_id));
        }
    }

    // Emit mutation
    let mutation = json!({
        "op": "remove_edge",
        "edgeId": edge_id,
    });
    if let Err(e) = app_handle.emit("diagram:mcp_mutated", &mutation) {
        return BridgeResponse::error(id, "INTERNAL_ERROR", format!("Failed to emit event: {}", e));
    }

    // Update cache
    {
        let mut cache = state.diagram_cache.write().await;
        if let Some(ref mut snapshot) = *cache {
            if let Some(edges) = snapshot.get_mut("edges").and_then(|e| e.as_array_mut()) {
                edges.retain(|e| e.get("id").and_then(|i| i.as_str()) != Some(&edge_id));
            }
        }
    }

    BridgeResponse::success(id, json!({}))
}

// ── Generate HCL (waits for frontend to sync files back) ─────────────────

async fn handle_generate_hcl(app_handle: &AppHandle) -> BridgeResponse {
    let id = String::new();

    let state = match app_handle.try_state::<McpState>() {
        Some(s) => s,
        None => return BridgeResponse::error(id, "INTERNAL_ERROR", "McpState not initialized"),
    };

    // Clear existing cache so we can detect when new files arrive
    *state.hcl_cache.write().await = None;

    // Tell frontend to generate HCL
    if let Err(e) = app_handle.emit("mcp:generate_hcl", &json!({})) {
        return BridgeResponse::error(id, "INTERNAL_ERROR", format!("Failed to emit event: {}", e));
    }

    // Wait up to 15 seconds for frontend to sync HCL files back
    let notified = tokio::time::timeout(
        std::time::Duration::from_secs(15),
        state.hcl_notify.notified(),
    )
    .await;

    if notified.is_err() {
        return BridgeResponse::error(
            id,
            "TIMEOUT",
            "HCL generation timed out — frontend did not sync files within 15s",
        );
    }

    // Return the cached files
    let cache = state.hcl_cache.read().await;
    match cache.as_ref() {
        Some(files) => BridgeResponse::success(id, files.clone()),
        None => BridgeResponse::error(id, "GENERATION_FAILED", "No HCL files were produced"),
    }
}

// ── Helper functions ───────────────────────────────────────────────────────

fn node_exists_in_cache(cache: &Option<Value>, instance_id: &str) -> bool {
    cache
        .as_ref()
        .and_then(|s| s.get("nodes"))
        .and_then(|n| n.as_array())
        .map(|nodes| {
            nodes
                .iter()
                .any(|n| n.get("id").and_then(|i| i.as_str()) == Some(instance_id))
        })
        .unwrap_or(false)
}

fn emit_and_ok(app_handle: &AppHandle, event: &str, data: Value) -> BridgeResponse {
    let id = String::new();
    if let Err(e) = app_handle.emit(event, &data) {
        return BridgeResponse::error(id, "INTERNAL_ERROR", format!("Failed to emit event: {}", e));
    }
    BridgeResponse::success(id, json!({ "ok": true }))
}

/// Generate a terraform-safe name from a resource type ID.
/// e.g., "azurerm/core/resource_group" → "rg_1"
fn generate_terraform_name(type_id: &str) -> String {
    let slug = type_id
        .split('/')
        .last()
        .unwrap_or("resource")
        .chars()
        .take(20)
        .collect::<String>();

    // Use a short hash of UUID to make it unique
    let suffix = &uuid::Uuid::new_v4().to_string()[..8];
    format!("{}_{}", slug, suffix)
}

/// Extract a display name from a resource type ID.
/// e.g., "azurerm/networking/virtual_network" → "Virtual Network"
fn get_display_name(type_id: &str) -> String {
    type_id
        .split('/')
        .last()
        .unwrap_or("Resource")
        .replace('_', " ")
        .split_whitespace()
        .map(|w| {
            let mut chars = w.chars();
            match chars.next() {
                None => String::new(),
                Some(c) => c.to_uppercase().to_string() + chars.as_str(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// Auto-position a new node based on existing nodes.
/// Grid layout: 250px apart horizontally, wrap every 4 nodes.
async fn auto_position(state: &McpState) -> Value {
    let cache = state.diagram_cache.read().await;
    let node_count = cache
        .as_ref()
        .and_then(|s| s.get("nodes"))
        .and_then(|n| n.as_array())
        .map(|arr| arr.len())
        .unwrap_or(0);

    let col = node_count % 4;
    let row = node_count / 4;
    json!({
        "x": 100.0 + (col as f64 * 250.0),
        "y": 100.0 + (row as f64 * 200.0),
    })
}
