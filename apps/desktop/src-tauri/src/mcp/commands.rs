use std::collections::HashMap;
use std::sync::Arc;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::{Mutex, RwLock};

use super::types::BridgeResponse;

// ── Per-window state ──────────────────────────────────────────────────────

/// State for a single registered window.
pub struct WindowEntry {
    pub project_name: Option<String>,
    pub project_path: Option<String>,
    pub diagram_cache: Option<Value>,
    pub hcl_cache: Option<Value>,
    pub hcl_notify: Arc<tokio::sync::Notify>,
}

impl WindowEntry {
    fn new() -> Self {
        Self {
            project_name: None,
            project_path: None,
            diagram_cache: None,
            hcl_cache: None,
            hcl_notify: Arc::new(tokio::sync::Notify::new()),
        }
    }
}

/// Shared MCP state managed by Tauri.
/// Per-window diagram/HCL caches; global resource types cache.
pub struct McpState {
    pub windows: RwLock<HashMap<String, WindowEntry>>,
    pub last_active_window: RwLock<Option<String>>,
    /// Resource types are the same across all windows (global plugin registry).
    pub resource_types_cache: RwLock<Value>,
    /// Serializes all write operations to prevent race conditions.
    write_lock: Mutex<()>,
}

impl McpState {
    pub fn new() -> Self {
        Self {
            windows: RwLock::new(HashMap::new()),
            last_active_window: RwLock::new(None),
            resource_types_cache: RwLock::new(json!([])),
            write_lock: Mutex::new(()),
        }
    }
}

// ── Window lifecycle commands (called from frontend) ──────────────────────

#[tauri::command]
pub async fn mcp_register_window(
    window_label: String,
    state: State<'_, McpState>,
) -> Result<(), String> {
    let mut windows = state.windows.write().await;
    windows.entry(window_label).or_insert_with(WindowEntry::new);
    Ok(())
}

#[tauri::command]
pub async fn mcp_unregister_window(
    window_label: String,
    state: State<'_, McpState>,
) -> Result<(), String> {
    state.windows.write().await.remove(&window_label);
    // Clear active window if it was this one
    let mut active = state.last_active_window.write().await;
    if active.as_deref() == Some(&window_label) {
        *active = None;
    }
    Ok(())
}

#[tauri::command]
pub async fn mcp_set_window_project(
    window_label: String,
    project_name: String,
    project_path: String,
    state: State<'_, McpState>,
) -> Result<(), String> {
    let mut windows = state.windows.write().await;
    let entry = windows.entry(window_label).or_insert_with(WindowEntry::new);
    entry.project_name = if project_name.is_empty() { None } else { Some(project_name) };
    entry.project_path = if project_path.is_empty() { None } else { Some(project_path) };
    // Clear caches when project is unloaded
    if entry.project_name.is_none() {
        entry.diagram_cache = None;
        entry.hcl_cache = None;
    }
    Ok(())
}

#[tauri::command]
pub async fn mcp_set_active_window(
    window_label: String,
    state: State<'_, McpState>,
) -> Result<(), String> {
    *state.last_active_window.write().await = Some(window_label);
    Ok(())
}

// ── Data sync commands (called from frontend to push data into cache) ─────

#[tauri::command]
pub async fn mcp_sync_diagram(
    window_label: String,
    nodes: Value,
    edges: Value,
    state: State<'_, McpState>,
) -> Result<(), String> {
    let snapshot = json!({ "nodes": nodes, "edges": edges });
    let mut windows = state.windows.write().await;
    let entry = windows.entry(window_label).or_insert_with(WindowEntry::new);
    entry.diagram_cache = Some(snapshot);
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
    window_label: String,
    files: Value,
    state: State<'_, McpState>,
) -> Result<(), String> {
    let mut windows = state.windows.write().await;
    let entry = windows.entry(window_label).or_insert_with(WindowEntry::new);
    entry.hcl_cache = Some(files);
    entry.hcl_notify.notify_waiters();
    Ok(())
}

// ── Window resolution ─────────────────────────────────────────────────────

/// Resolve a target window label from the optional "project" parameter.
/// Matches by: project name (case-insensitive) → window label → project path.
/// Falls back to last_active_window, then first window with an open project.
async fn resolve_window_label(
    params: &Value,
    state: &McpState,
) -> Result<String, BridgeResponse> {
    // 1. Check for explicit "project" parameter
    if let Some(project_param) = params.get("project").and_then(|p| p.as_str()) {
        let windows = state.windows.read().await;

        // Match by project name (case-insensitive)
        if let Some((label, _)) = windows.iter().find(|(_, e)| {
            e.project_name
                .as_deref()
                .map(|n| n.eq_ignore_ascii_case(project_param))
                .unwrap_or(false)
        }) {
            return Ok(label.clone());
        }

        // Match by window label
        if windows.contains_key(project_param) {
            return Ok(project_param.to_string());
        }

        // Match by project path
        if let Some((label, _)) = windows.iter().find(|(_, e)| {
            e.project_path.as_deref() == Some(project_param)
        }) {
            return Ok(label.clone());
        }

        return Err(BridgeResponse::error(
            String::new(),
            "PROJECT_NOT_FOUND",
            format!("No open project matching: {}", project_param),
        ));
    }

    // 2. Fallback to last active window
    let active = state.last_active_window.read().await;
    if let Some(label) = active.as_ref() {
        let windows = state.windows.read().await;
        if windows.contains_key(label) {
            return Ok(label.clone());
        }
    }
    drop(active);

    // 3. First window with an open project
    let windows = state.windows.read().await;
    windows
        .iter()
        .find(|(_, e)| e.project_name.is_some())
        .map(|(label, _)| label.clone())
        .or_else(|| windows.keys().next().cloned())
        .ok_or_else(|| {
            BridgeResponse::error(
                String::new(),
                "NO_PROJECT",
                "No open projects found. Open a project first.",
            )
        })
}

// ── Bridge command dispatcher (called from WebSocket handler) ─────────────

/// Dispatch a bridge command from the sidecar and return a response.
pub async fn dispatch_bridge_command(
    command: &str,
    params: Value,
    app_handle: &AppHandle,
) -> BridgeResponse {
    let id = String::new();

    let state = match app_handle.try_state::<McpState>() {
        Some(s) => s,
        None => {
            return BridgeResponse::error(id, "INTERNAL_ERROR", "McpState not initialized");
        }
    };

    match command {
        // ── Discovery ──
        "mcp_list_projects" => {
            let windows = state.windows.read().await;
            let projects: Vec<Value> = windows
                .iter()
                .map(|(label, entry)| {
                    json!({
                        "windowLabel": label,
                        "projectName": entry.project_name,
                        "projectPath": entry.project_path,
                        "hasDiagram": entry.diagram_cache.is_some(),
                    })
                })
                .collect();
            let active = state.last_active_window.read().await;
            BridgeResponse::success(
                id,
                json!({ "projects": projects, "activeWindow": *active }),
            )
        }

        // ── Read commands ──
        "mcp_get_diagram_snapshot" => {
            let label = match resolve_window_label(&params, &state).await {
                Ok(l) => l,
                Err(e) => return e,
            };
            let windows = state.windows.read().await;
            match windows.get(&label).and_then(|e| e.diagram_cache.as_ref()) {
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

        "mcp_set_enabled_outputs" => {
            let _guard = state.write_lock.lock().await;
            handle_set_enabled_outputs(params, &state, app_handle).await
        }

        "mcp_connect_resources" => {
            let _guard = state.write_lock.lock().await;
            handle_connect_resources(params, &state, app_handle).await
        }

        "mcp_disconnect_resources" => {
            let _guard = state.write_lock.lock().await;
            handle_disconnect_resources(params, &state, app_handle).await
        }

        "mcp_move_resource" => {
            let _guard = state.write_lock.lock().await;
            handle_move_resource(params, &state, app_handle).await
        }

        "mcp_resize_resource" => {
            let _guard = state.write_lock.lock().await;
            handle_resize_resource(params, &state, app_handle).await
        }

        // ── Project/Terraform commands (delegated to frontend via events) ──
        "mcp_save_project" => {
            let label = match resolve_window_label(&params, &state).await {
                Ok(l) => l,
                Err(e) => return e,
            };
            emit_to_and_ok(app_handle, &label, "mcp:save_project", json!({}))
        }

        "mcp_generate_hcl" => {
            let label = match resolve_window_label(&params, &state).await {
                Ok(l) => l,
                Err(e) => return e,
            };
            handle_generate_hcl(&label, app_handle).await
        }

        "mcp_get_hcl_files" => {
            let label = match resolve_window_label(&params, &state).await {
                Ok(l) => l,
                Err(e) => return e,
            };
            let windows = state.windows.read().await;
            match windows.get(&label).and_then(|e| e.hcl_cache.as_ref()) {
                Some(files) => BridgeResponse::success(String::new(), files.clone()),
                None => BridgeResponse::success(String::new(), json!({})),
            }
        }

        "mcp_run_terraform" => {
            let label = match resolve_window_label(&params, &state).await {
                Ok(l) => l,
                Err(e) => return e,
            };
            let command_name = params.get("command").and_then(|c| c.as_str()).unwrap_or("");
            emit_to_and_ok(app_handle, &label, "mcp:run_terraform", json!({ "command": command_name }))
        }

        "mcp_open_project" => {
            let path = params.get("projectPath").and_then(|p| p.as_str()).unwrap_or("");
            // Open project broadcasts to all — any window on the welcome screen can pick it up
            emit_and_ok(app_handle, "mcp:open_project", json!({ "projectPath": path }))
        }

        "mcp_new_project" => {
            emit_and_ok(app_handle, "mcp:new_project", params)
        }

        "mcp_get_project_config" => {
            let label = match resolve_window_label(&params, &state).await {
                Ok(l) => l,
                Err(e) => return e,
            };
            emit_to_and_ok(app_handle, &label, "mcp:get_project_config", json!({}))
        }

        "mcp_set_project_config" => {
            let label = match resolve_window_label(&params, &state).await {
                Ok(l) => l,
                Err(e) => return e,
            };
            emit_to_and_ok(app_handle, &label, "mcp:set_project_config", params)
        }

        "mcp_get_deployment_status" => {
            let label = match resolve_window_label(&params, &state).await {
                Ok(l) => l,
                Err(e) => return e,
            };
            let windows = state.windows.read().await;
            let cache = windows.get(&label).and_then(|e| e.diagram_cache.as_ref());
            match cache {
                Some(snapshot) => {
                    let nodes = snapshot.get("nodes").and_then(|n| n.as_array());
                    let mut status_map = serde_json::Map::new();
                    if let Some(nodes) = nodes {
                        for node in nodes {
                            if let (Some(nid), Some(data)) = (
                                node.get("id").and_then(|i| i.as_str()),
                                node.get("data"),
                            ) {
                                let deploy_status = data
                                    .get("deploymentStatus")
                                    .cloned()
                                    .unwrap_or(json!("pending"));
                                status_map.insert(nid.to_string(), deploy_status);
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

// ── Mutation handlers ─────────────────────────────────────────────────────

async fn handle_add_resource(
    params: Value,
    state: &McpState,
    app_handle: &AppHandle,
) -> BridgeResponse {
    let id = String::new();

    let label = match resolve_window_label(&params, state).await {
        Ok(l) => l,
        Err(e) => return e,
    };

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

    // Validate parentId if provided: check existence + canBeChildOf containment rules
    let parent_id = params.get("parentId").and_then(|p| p.as_str()).map(String::from);
    if let Some(ref pid) = parent_id {
        let windows = state.windows.read().await;
        let cache = windows.get(&label).and_then(|e| e.diagram_cache.as_ref());
        if !node_exists_in_snapshot(cache, pid) {
            return BridgeResponse::error(
                id,
                "VALIDATION_ERROR",
                format!("Parent node not found: {}", pid),
            );
        }

        // Validate containment: child type must list parent type in canBeChildOf
        let parent_type = get_node_type_in_snapshot(cache, pid);
        if let Some(ref pt) = parent_type {
            let types = state.resource_types_cache.read().await;
            if let Err(msg) = validate_containment(&types, &type_id, pt) {
                return BridgeResponse::error(id, "CONTAINMENT_ERROR", msg);
            }
        }
    }

    let instance_id = uuid::Uuid::new_v4().to_string();
    let tf_name = generate_terraform_name(&type_id);

    let position = if let Some(pos) = params.get("position") {
        pos.clone()
    } else {
        auto_position_for_window(state, &label).await
    };

    let properties = params.get("properties").cloned().unwrap_or(json!({}));

    // Split incoming properties into regular properties and references
    let reference_keys: std::collections::HashSet<String> = {
        let types = state.resource_types_cache.read().await;
        types.as_array()
            .and_then(|arr| arr.iter().find(|t| t.get("typeId").and_then(|i| i.as_str()) == Some(&type_id)))
            .and_then(|t| t.get("properties"))
            .and_then(|p| p.as_array())
            .map(|props| {
                props.iter()
                    .filter(|p| p.get("type").and_then(|t| t.as_str()) == Some("reference"))
                    .filter_map(|p| p.get("key").and_then(|k| k.as_str()).map(String::from))
                    .collect()
            })
            .unwrap_or_default()
    };

    let mut regular_props = serde_json::Map::new();
    let mut references = serde_json::Map::new();
    if let Some(obj) = properties.as_object() {
        for (k, v) in obj {
            if reference_keys.contains(k) {
                if !v.is_null() {
                    references.insert(k.clone(), v.clone());
                }
            } else {
                regular_props.insert(k.clone(), v.clone());
            }
        }
    }

    // Use properties.name as label if provided, otherwise use schema display name
    let display_label = regular_props
        .get("name")
        .and_then(|n| n.as_str())
        .filter(|s| !s.is_empty())
        .map(String::from)
        .unwrap_or_else(|| get_display_name(&type_id));

    let enabled_outputs = params.get("enabledOutputs").cloned().unwrap_or(json!([]));

    let node_data = json!({
        "typeId": type_id,
        "label": display_label,
        "terraformName": tf_name,
        "properties": Value::Object(regular_props),
        "references": Value::Object(references),
        "validationErrors": [],
        "deploymentStatus": "pending",
        "enabledOutputs": enabled_outputs,
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

    // Emit mutation to targeted window
    let mutation = json!({ "op": "add_node", "payload": node });
    if let Err(e) = app_handle.emit_to(&label, "diagram:mcp_mutated", &mutation) {
        return BridgeResponse::error(id, "INTERNAL_ERROR", format!("Failed to emit event: {}", e));
    }

    // Update per-window cache
    {
        let mut windows = state.windows.write().await;
        if let Some(entry) = windows.get_mut(&label) {
            if let Some(ref mut snapshot) = entry.diagram_cache {
                if let Some(nodes) = snapshot.get_mut("nodes").and_then(|n| n.as_array_mut()) {
                    nodes.push(node);
                }
            }
        }
    }

    BridgeResponse::success(
        id,
        json!({ "instanceId": instance_id, "terraformName": tf_name, "position": position }),
    )
}

async fn handle_update_resource(
    params: Value,
    state: &McpState,
    app_handle: &AppHandle,
) -> BridgeResponse {
    let id = String::new();

    let label = match resolve_window_label(&params, state).await {
        Ok(l) => l,
        Err(e) => return e,
    };

    let instance_id = match params.get("instanceId").and_then(|i| i.as_str()) {
        Some(i) => i.to_string(),
        None => return BridgeResponse::error(id, "VALIDATION_ERROR", "instanceId is required"),
    };

    let properties = match params.get("properties") {
        Some(p) => p.clone(),
        None => return BridgeResponse::error(id, "VALIDATION_ERROR", "properties is required"),
    };

    // Look up the node's typeId to determine which keys are reference properties
    let node_type_id = {
        let windows = state.windows.read().await;
        let cache = windows.get(&label).and_then(|e| e.diagram_cache.as_ref());
        match get_node_type_in_snapshot(cache, &instance_id) {
            Some(t) => t,
            None => return BridgeResponse::error(
                id, "NOT_FOUND", format!("Resource not found: {}", instance_id),
            ),
        }
    };

    // Build a set of property keys that are type: 'reference' from the resource types cache
    let reference_keys: std::collections::HashSet<String> = {
        let types = state.resource_types_cache.read().await;
        types.as_array()
            .and_then(|arr| arr.iter().find(|t| t.get("typeId").and_then(|i| i.as_str()) == Some(&node_type_id)))
            .and_then(|t| t.get("properties"))
            .and_then(|p| p.as_array())
            .map(|props| {
                props.iter()
                    .filter(|p| p.get("type").and_then(|t| t.as_str()) == Some("reference"))
                    .filter_map(|p| p.get("key").and_then(|k| k.as_str()).map(String::from))
                    .collect()
            })
            .unwrap_or_default()
    };

    // Split incoming properties into regular properties and references
    let mut regular_props = serde_json::Map::new();
    let mut ref_props = serde_json::Map::new();
    if let Some(obj) = properties.as_object() {
        for (k, v) in obj {
            if reference_keys.contains(k) {
                ref_props.insert(k.clone(), v.clone());
            } else {
                regular_props.insert(k.clone(), v.clone());
            }
        }
    }

    // Merge properties and references in cache, then emit to frontend
    let (merged_properties, merged_references) = {
        let mut windows = state.windows.write().await;
        let mut merged_props = Value::Object(regular_props.clone());
        let mut merged_refs = Value::Object(ref_props.clone());

        if let Some(entry) = windows.get_mut(&label) {
            if let Some(ref mut snapshot) = entry.diagram_cache {
                if let Some(nodes) = snapshot.get_mut("nodes").and_then(|n| n.as_array_mut()) {
                    let found = nodes.iter_mut().find(|n| {
                        n.get("id").and_then(|i| i.as_str()) == Some(&instance_id)
                    });
                    match found {
                        None => {
                            return BridgeResponse::error(
                                id, "NOT_FOUND", format!("Resource not found: {}", instance_id),
                            );
                        }
                        Some(node) => {
                            if let Some(data) = node.get_mut("data") {
                                // Merge regular properties
                                if !regular_props.is_empty() {
                                    if let Some(existing_props) = data.get_mut("properties") {
                                        if let Some(existing_obj) = existing_props.as_object_mut() {
                                            for (k, v) in &regular_props {
                                                existing_obj.insert(k.clone(), v.clone());
                                            }
                                            merged_props = Value::Object(existing_obj.clone());
                                        }
                                    }
                                }

                                // Merge references
                                if !ref_props.is_empty() {
                                    if let Some(existing_refs) = data.get_mut("references") {
                                        if let Some(existing_obj) = existing_refs.as_object_mut() {
                                            for (k, v) in &ref_props {
                                                if v.is_null() {
                                                    // null means remove the reference
                                                    existing_obj.remove(k);
                                                } else {
                                                    existing_obj.insert(k.clone(), v.clone());
                                                }
                                            }
                                            merged_refs = Value::Object(existing_obj.clone());
                                        }
                                    } else {
                                        // No existing references — create from scratch
                                        data["references"] = Value::Object(ref_props.clone());
                                        merged_refs = Value::Object(ref_props.clone());
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                return BridgeResponse::error(
                    id, "NOT_FOUND", format!("Resource not found: {}", instance_id),
                );
            }
        }

        (merged_props, merged_refs)
    };

    // Build mutation data
    let mut mutation_data = json!({});
    if !regular_props.is_empty() {
        mutation_data["properties"] = merged_properties.clone();
    }
    if !ref_props.is_empty() {
        mutation_data["references"] = merged_references;
    }

    // If properties include "name", update the display label too (mirrors sidebar behavior)
    if let Some(name_val) = merged_properties.get("name").and_then(|n| n.as_str()) {
        if !name_val.is_empty() {
            mutation_data["label"] = json!(name_val);
            // Also update label in the cache
            let mut windows = state.windows.write().await;
            if let Some(entry) = windows.get_mut(&label) {
                if let Some(ref mut snapshot) = entry.diagram_cache {
                    if let Some(nodes) = snapshot.get_mut("nodes").and_then(|n| n.as_array_mut()) {
                        if let Some(node) = nodes.iter_mut().find(|n| n.get("id").and_then(|i| i.as_str()) == Some(&instance_id)) {
                            if let Some(data) = node.get_mut("data") {
                                data["label"] = json!(name_val);
                            }
                        }
                    }
                }
            }
        }
    }

    let mutation = json!({
        "op": "update_node_data",
        "instanceId": instance_id,
        "data": mutation_data,
    });
    if let Err(e) = app_handle.emit_to(&label, "diagram:mcp_mutated", &mutation) {
        return BridgeResponse::error(id, "INTERNAL_ERROR", format!("Failed to emit event: {}", e));
    }

    BridgeResponse::success(id, json!({}))
}

async fn handle_remove_resource(
    params: Value,
    state: &McpState,
    app_handle: &AppHandle,
) -> BridgeResponse {
    let id = String::new();

    let label = match resolve_window_label(&params, state).await {
        Ok(l) => l,
        Err(e) => return e,
    };

    let instance_id = match params.get("instanceId").and_then(|i| i.as_str()) {
        Some(i) => i.to_string(),
        None => return BridgeResponse::error(id, "VALIDATION_ERROR", "instanceId is required"),
    };

    {
        let windows = state.windows.read().await;
        let cache = windows.get(&label).and_then(|e| e.diagram_cache.as_ref());
        if !node_exists_in_snapshot(cache, &instance_id) {
            return BridgeResponse::error(id, "NOT_FOUND", format!("Resource not found: {}", instance_id));
        }
    }

    let mutation = json!({ "op": "remove_node", "instanceId": instance_id });
    if let Err(e) = app_handle.emit_to(&label, "diagram:mcp_mutated", &mutation) {
        return BridgeResponse::error(id, "INTERNAL_ERROR", format!("Failed to emit event: {}", e));
    }

    // Update cache — remove node and connected edges
    {
        let mut windows = state.windows.write().await;
        if let Some(entry) = windows.get_mut(&label) {
            if let Some(ref mut snapshot) = entry.diagram_cache {
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
                        n.get("id").and_then(|i| i.as_str())
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
    }

    BridgeResponse::success(id, json!({}))
}

async fn handle_set_enabled_outputs(
    params: Value,
    state: &McpState,
    app_handle: &AppHandle,
) -> BridgeResponse {
    let id = String::new();

    let label = match resolve_window_label(&params, state).await {
        Ok(l) => l,
        Err(e) => return e,
    };

    let instance_id = match params.get("instanceId").and_then(|i| i.as_str()) {
        Some(i) => i.to_string(),
        None => return BridgeResponse::error(id, "VALIDATION_ERROR", "instanceId is required"),
    };

    let enabled_outputs = match params.get("enabledOutputs") {
        Some(v) => v.clone(),
        None => return BridgeResponse::error(id, "VALIDATION_ERROR", "enabledOutputs is required"),
    };

    // Update enabledOutputs in cache
    {
        let mut windows = state.windows.write().await;
        if let Some(entry) = windows.get_mut(&label) {
            if let Some(ref mut snapshot) = entry.diagram_cache {
                if let Some(nodes) = snapshot.get_mut("nodes").and_then(|n| n.as_array_mut()) {
                    let found = nodes.iter_mut().find(|n| {
                        n.get("id").and_then(|i| i.as_str()) == Some(&instance_id)
                    });
                    match found {
                        None => {
                            return BridgeResponse::error(
                                id, "NOT_FOUND", format!("Resource not found: {}", instance_id),
                            );
                        }
                        Some(node) => {
                            if let Some(data) = node.get_mut("data") {
                                data["enabledOutputs"] = enabled_outputs.clone();
                            }
                        }
                    }
                }
            } else {
                return BridgeResponse::error(
                    id, "NOT_FOUND", format!("Resource not found: {}", instance_id),
                );
            }
        }
    }

    let mutation = json!({
        "op": "update_node_data",
        "instanceId": instance_id,
        "data": { "enabledOutputs": enabled_outputs },
    });
    if let Err(e) = app_handle.emit_to(&label, "diagram:mcp_mutated", &mutation) {
        return BridgeResponse::error(id, "INTERNAL_ERROR", format!("Failed to emit event: {}", e));
    }

    BridgeResponse::success(id, json!({}))
}

async fn handle_connect_resources(
    params: Value,
    state: &McpState,
    app_handle: &AppHandle,
) -> BridgeResponse {
    let id = String::new();

    let label = match resolve_window_label(&params, state).await {
        Ok(l) => l,
        Err(e) => return e,
    };

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

    {
        let windows = state.windows.read().await;
        let cache = windows.get(&label).and_then(|e| e.diagram_cache.as_ref());
        if !node_exists_in_snapshot(cache, &source_id) {
            return BridgeResponse::error(id, "NOT_FOUND", format!("Source resource not found: {}", source_id));
        }
        if !node_exists_in_snapshot(cache, &target_id) {
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

    let mutation = json!({ "op": "add_edge", "payload": edge });
    if let Err(e) = app_handle.emit_to(&label, "diagram:mcp_mutated", &mutation) {
        return BridgeResponse::error(id, "INTERNAL_ERROR", format!("Failed to emit event: {}", e));
    }

    {
        let mut windows = state.windows.write().await;
        if let Some(entry) = windows.get_mut(&label) {
            if let Some(ref mut snapshot) = entry.diagram_cache {
                if let Some(edges) = snapshot.get_mut("edges").and_then(|e| e.as_array_mut()) {
                    edges.push(edge);
                }
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

    let label = match resolve_window_label(&params, state).await {
        Ok(l) => l,
        Err(e) => return e,
    };

    let edge_id = match params.get("edgeId").and_then(|e| e.as_str()) {
        Some(e) => e.to_string(),
        None => return BridgeResponse::error(id, "VALIDATION_ERROR", "edgeId is required"),
    };

    {
        let windows = state.windows.read().await;
        let exists = windows
            .get(&label)
            .and_then(|e| e.diagram_cache.as_ref())
            .and_then(|s| s.get("edges"))
            .and_then(|e| e.as_array())
            .map(|edges| edges.iter().any(|e| e.get("id").and_then(|i| i.as_str()) == Some(&edge_id)))
            .unwrap_or(false);
        if !exists {
            return BridgeResponse::error(id, "NOT_FOUND", format!("Edge not found: {}", edge_id));
        }
    }

    let mutation = json!({ "op": "remove_edge", "edgeId": edge_id });
    if let Err(e) = app_handle.emit_to(&label, "diagram:mcp_mutated", &mutation) {
        return BridgeResponse::error(id, "INTERNAL_ERROR", format!("Failed to emit event: {}", e));
    }

    {
        let mut windows = state.windows.write().await;
        if let Some(entry) = windows.get_mut(&label) {
            if let Some(ref mut snapshot) = entry.diagram_cache {
                if let Some(edges) = snapshot.get_mut("edges").and_then(|e| e.as_array_mut()) {
                    edges.retain(|e| e.get("id").and_then(|i| i.as_str()) != Some(&edge_id));
                }
            }
        }
    }

    BridgeResponse::success(id, json!({}))
}

async fn handle_move_resource(
    params: Value,
    state: &McpState,
    app_handle: &AppHandle,
) -> BridgeResponse {
    let id = String::new();

    let label = match resolve_window_label(&params, state).await {
        Ok(l) => l,
        Err(e) => return e,
    };

    let instance_id = match params.get("instanceId").and_then(|i| i.as_str()) {
        Some(i) => i.to_string(),
        None => return BridgeResponse::error(id, "VALIDATION_ERROR", "instanceId is required"),
    };

    let position = match params.get("position") {
        Some(p) => p.clone(),
        None => return BridgeResponse::error(id, "VALIDATION_ERROR", "position is required"),
    };

    // Optional parentId for reparenting (set to null to unparent)
    let new_parent_id = params.get("parentId");
    let reparent = new_parent_id.is_some();
    let new_parent_str = new_parent_id.and_then(|p| {
        if p.is_null() { None } else { p.as_str().map(String::from) }
    });

    // Validate reparenting if requested
    if reparent {
        if let Some(ref new_pid) = new_parent_str {
            // Verify new parent exists
            let windows = state.windows.read().await;
            let cache = windows.get(&label).and_then(|e| e.diagram_cache.as_ref());
            if !node_exists_in_snapshot(cache, new_pid) {
                return BridgeResponse::error(
                    id, "NOT_FOUND", format!("Parent node not found: {}", new_pid),
                );
            }

            // Get the moved node's type for containment check
            let node_type = get_node_type_in_snapshot(cache, &instance_id);
            let parent_type = get_node_type_in_snapshot(cache, new_pid);

            if let (Some(ref nt), Some(ref pt)) = (node_type, parent_type) {
                let types = state.resource_types_cache.read().await;
                if let Err(msg) = validate_containment(&types, nt, pt) {
                    return BridgeResponse::error(id, "CONTAINMENT_ERROR", msg);
                }
            }
        }
    }

    {
        let mut windows = state.windows.write().await;
        if let Some(entry) = windows.get_mut(&label) {
            if let Some(ref mut snapshot) = entry.diagram_cache {
                if let Some(nodes) = snapshot.get_mut("nodes").and_then(|n| n.as_array_mut()) {
                    let found = nodes.iter_mut().find(|n| {
                        n.get("id").and_then(|i| i.as_str()) == Some(&instance_id)
                    });
                    match found {
                        None => {
                            return BridgeResponse::error(
                                id, "NOT_FOUND", format!("Resource not found: {}", instance_id),
                            );
                        }
                        Some(node) => {
                            node["position"] = position.clone();
                            if reparent {
                                match &new_parent_str {
                                    Some(pid) => {
                                        node["parentId"] = json!(pid);
                                        node["extent"] = json!("parent");
                                    }
                                    None => {
                                        // Unparent: remove parentId and extent
                                        if let Some(obj) = node.as_object_mut() {
                                            obj.remove("parentId");
                                            obj.remove("extent");
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                return BridgeResponse::error(
                    id, "NOT_FOUND", format!("Resource not found: {}", instance_id),
                );
            }
        }
    }

    if reparent {
        // Emit reparent mutation (includes position + parentId change)
        let mutation = json!({
            "op": "reparent_node",
            "instanceId": instance_id,
            "position": position,
            "parentId": new_parent_str,
        });
        if let Err(e) = app_handle.emit_to(&label, "diagram:mcp_mutated", &mutation) {
            return BridgeResponse::error(id, "INTERNAL_ERROR", format!("Failed to emit event: {}", e));
        }
    } else {
        let mutation = json!({
            "op": "move_node",
            "instanceId": instance_id,
            "position": position,
        });
        if let Err(e) = app_handle.emit_to(&label, "diagram:mcp_mutated", &mutation) {
            return BridgeResponse::error(id, "INTERNAL_ERROR", format!("Failed to emit event: {}", e));
        }
    }

    BridgeResponse::success(id, json!({}))
}

async fn handle_resize_resource(
    params: Value,
    state: &McpState,
    app_handle: &AppHandle,
) -> BridgeResponse {
    let id = String::new();

    let label = match resolve_window_label(&params, state).await {
        Ok(l) => l,
        Err(e) => return e,
    };

    let instance_id = match params.get("instanceId").and_then(|i| i.as_str()) {
        Some(i) => i.to_string(),
        None => return BridgeResponse::error(id, "VALIDATION_ERROR", "instanceId is required"),
    };

    let width = match params.get("width").and_then(|w| w.as_f64()) {
        Some(w) => w,
        None => return BridgeResponse::error(id, "VALIDATION_ERROR", "width is required"),
    };

    let height = match params.get("height").and_then(|h| h.as_f64()) {
        Some(h) => h,
        None => return BridgeResponse::error(id, "VALIDATION_ERROR", "height is required"),
    };

    {
        let mut windows = state.windows.write().await;
        if let Some(entry) = windows.get_mut(&label) {
            if let Some(ref mut snapshot) = entry.diagram_cache {
                if let Some(nodes) = snapshot.get_mut("nodes").and_then(|n| n.as_array_mut()) {
                    let found = nodes.iter_mut().find(|n| {
                        n.get("id").and_then(|i| i.as_str()) == Some(&instance_id)
                    });
                    match found {
                        None => {
                            return BridgeResponse::error(
                                id, "NOT_FOUND", format!("Resource not found: {}", instance_id),
                            );
                        }
                        Some(node) => {
                            node["width"] = json!(width);
                            node["height"] = json!(height);
                        }
                    }
                }
            } else {
                return BridgeResponse::error(
                    id, "NOT_FOUND", format!("Resource not found: {}", instance_id),
                );
            }
        }
    }

    let mutation = json!({
        "op": "resize_node",
        "instanceId": instance_id,
        "width": width,
        "height": height,
    });
    if let Err(e) = app_handle.emit_to(&label, "diagram:mcp_mutated", &mutation) {
        return BridgeResponse::error(id, "INTERNAL_ERROR", format!("Failed to emit event: {}", e));
    }

    BridgeResponse::success(id, json!({}))
}

// ── Generate HCL (waits for frontend to sync files back) ─────────────────

async fn handle_generate_hcl(window_label: &str, app_handle: &AppHandle) -> BridgeResponse {
    let id = String::new();

    let state = match app_handle.try_state::<McpState>() {
        Some(s) => s,
        None => return BridgeResponse::error(id, "INTERNAL_ERROR", "McpState not initialized"),
    };

    // Clone the Arc<Notify> and clear HCL cache, then release the lock before awaiting
    let notify = {
        let mut windows = state.windows.write().await;
        match windows.get_mut(window_label) {
            Some(entry) => {
                entry.hcl_cache = None;
                entry.hcl_notify.clone()
            }
            None => return BridgeResponse::error(id, "NO_PROJECT", format!("Window not found: {}", window_label)),
        }
    };

    // Tell the targeted window to generate HCL
    if let Err(e) = app_handle.emit_to(window_label, "mcp:generate_hcl", &json!({})) {
        return BridgeResponse::error(id, "INTERNAL_ERROR", format!("Failed to emit event: {}", e));
    }

    // Wait up to 15 seconds for that window to sync HCL files back
    let notified = tokio::time::timeout(
        std::time::Duration::from_secs(15),
        notify.notified(),
    )
    .await;

    if notified.is_err() {
        return BridgeResponse::error(
            id,
            "TIMEOUT",
            "HCL generation timed out — frontend did not sync files within 15s",
        );
    }

    // Read from the targeted window's HCL cache
    let windows = state.windows.read().await;
    match windows.get(window_label).and_then(|e| e.hcl_cache.as_ref()) {
        Some(files) => BridgeResponse::success(id, files.clone()),
        None => BridgeResponse::error(id, "GENERATION_FAILED", "No HCL files were produced"),
    }
}

// ── Helper functions ──────────────────────────────────────────────────────

fn node_exists_in_snapshot(snapshot: Option<&Value>, instance_id: &str) -> bool {
    snapshot
        .and_then(|s| s.get("nodes"))
        .and_then(|n| n.as_array())
        .map(|nodes| nodes.iter().any(|n| n.get("id").and_then(|i| i.as_str()) == Some(instance_id)))
        .unwrap_or(false)
}

/// Get the typeId of a node in the diagram snapshot.
fn get_node_type_in_snapshot(snapshot: Option<&Value>, instance_id: &str) -> Option<String> {
    snapshot
        .and_then(|s| s.get("nodes"))
        .and_then(|n| n.as_array())
        .and_then(|nodes| {
            nodes.iter().find(|n| n.get("id").and_then(|i| i.as_str()) == Some(instance_id))
        })
        .and_then(|n| n.get("type").and_then(|t| t.as_str()))
        .map(String::from)
}

/// Validate that a child resource type is allowed inside a parent resource type
/// according to canBeChildOf rules from the resource types cache.
/// Returns Ok(()) if valid, or an error message if not.
fn validate_containment(
    resource_types: &Value,
    child_type_id: &str,
    parent_type_id: &str,
) -> Result<(), String> {
    let types = resource_types.as_array();

    // Check that parent is a container
    let parent_is_container = types
        .and_then(|arr| arr.iter().find(|t| t.get("typeId").and_then(|i| i.as_str()) == Some(parent_type_id)))
        .and_then(|t| t.get("isContainer").and_then(|c| c.as_bool()))
        .unwrap_or(false);

    if !parent_is_container {
        return Err(format!(
            "Resource type '{}' is not a container and cannot have children",
            parent_type_id
        ));
    }

    // Check canBeChildOf on the child type
    let child_type = types
        .and_then(|arr| arr.iter().find(|t| t.get("typeId").and_then(|i| i.as_str()) == Some(child_type_id)));

    let allowed_parents = child_type
        .and_then(|t| t.get("canBeChildOf"))
        .and_then(|c| c.as_array());

    match allowed_parents {
        None => {
            // No canBeChildOf defined — resource cannot be placed in any container
            Err(format!(
                "Resource type '{}' cannot be placed inside any container",
                child_type_id
            ))
        }
        Some(parents) => {
            let is_allowed = parents.iter().any(|p| p.as_str() == Some(parent_type_id));
            if is_allowed {
                Ok(())
            } else {
                let allowed: Vec<&str> = parents.iter().filter_map(|p| p.as_str()).collect();
                Err(format!(
                    "Resource type '{}' cannot be placed inside '{}'. Allowed parents: {:?}",
                    child_type_id, parent_type_id, allowed
                ))
            }
        }
    }
}

fn emit_and_ok(app_handle: &AppHandle, event: &str, data: Value) -> BridgeResponse {
    let id = String::new();
    if let Err(e) = app_handle.emit(event, &data) {
        return BridgeResponse::error(id, "INTERNAL_ERROR", format!("Failed to emit event: {}", e));
    }
    BridgeResponse::success(id, json!({ "ok": true }))
}

fn emit_to_and_ok(app_handle: &AppHandle, window_label: &str, event: &str, data: Value) -> BridgeResponse {
    let id = String::new();
    if let Err(e) = app_handle.emit_to(window_label, event, &data) {
        return BridgeResponse::error(id, "INTERNAL_ERROR", format!("Failed to emit event: {}", e));
    }
    BridgeResponse::success(id, json!({ "ok": true }))
}

/// Generate a terraform-safe name from a resource type ID.
fn generate_terraform_name(type_id: &str) -> String {
    let slug = type_id
        .split('/')
        .last()
        .unwrap_or("resource")
        .chars()
        .take(20)
        .collect::<String>();
    let suffix = &uuid::Uuid::new_v4().to_string()[..8];
    format!("{}_{}", slug, suffix)
}

/// Extract a display name from a resource type ID.
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

/// Auto-position a new node based on existing nodes in the target window.
async fn auto_position_for_window(state: &McpState, window_label: &str) -> Value {
    let windows = state.windows.read().await;
    let node_count = windows
        .get(window_label)
        .and_then(|e| e.diagram_cache.as_ref())
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
