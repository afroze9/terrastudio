use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

#[derive(Clone, Serialize)]
pub struct TerraformOutput {
    pub stream: String,
    pub line: String,
}

#[derive(Clone, Serialize)]
pub struct TerraformExit {
    pub code: i32,
    pub success: bool,
}

#[derive(Clone, Serialize)]
pub struct TerraformStatus {
    pub status: String,
    pub command: String,
}

/// Terraform JSON output message (line-by-line from -json flag)
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct TerraformJsonMessage {
    #[serde(rename = "@level")]
    pub level: String,
    #[serde(rename = "@message")]
    pub message: String,
    #[serde(rename = "@module", default)]
    pub module: String,
    #[serde(rename = "@timestamp", default)]
    pub timestamp: String,
    #[serde(rename = "type", default)]
    pub msg_type: String,
    #[serde(default)]
    pub diagnostic: Option<TerraformDiagnostic>,
    #[serde(default)]
    pub hook: Option<serde_json::Value>,
    #[serde(default)]
    pub change: Option<TerraformChange>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct TerraformDiagnostic {
    pub severity: String,
    pub summary: String,
    #[serde(default)]
    pub detail: String,
    #[serde(default)]
    pub address: Option<String>,
    #[serde(default)]
    pub range: Option<TerraformRange>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct TerraformRange {
    pub filename: String,
    pub start: TerraformPosition,
    pub end: TerraformPosition,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct TerraformPosition {
    pub line: u32,
    pub column: u32,
    pub byte: u32,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct TerraformChange {
    #[serde(default)]
    pub resource: Option<TerraformResourceChange>,
    #[serde(default)]
    pub action: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct TerraformResourceChange {
    #[serde(default)]
    pub addr: String,
    #[serde(default)]
    pub resource: String,
    #[serde(default)]
    pub resource_type: String,
    #[serde(default)]
    pub resource_name: String,
}

/// Result from running terraform with JSON output
#[derive(Clone, Serialize)]
pub struct TerraformJsonResult {
    pub success: bool,
    pub code: i32,
    pub diagnostics: Vec<TerraformDiagnostic>,
    pub resource_changes: Vec<ResourceChangeInfo>,
}

#[derive(Clone, Serialize)]
pub struct ResourceChangeInfo {
    pub address: String,
    pub action: String,
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// A single resource change from `terraform plan -json` with full before/after diffs.
#[derive(Clone, Serialize, Deserialize)]
pub struct PlanResourceChange {
    pub address: String,
    #[serde(default)]
    pub module_address: String,
    pub actions: Vec<String>,
    #[serde(default)]
    pub before: Option<serde_json::Value>,
    #[serde(default)]
    pub after: Option<serde_json::Value>,
}

/// Extended result from terraform plan that includes full before/after diffs.
#[derive(Clone, Serialize)]
pub struct TerraformPlanResult {
    pub success: bool,
    pub code: i32,
    pub diagnostics: Vec<TerraformDiagnostic>,
    pub plan_changes: Vec<PlanResourceChange>,
    pub plan_file_path: String,
}

/// Run a terraform command and capture all output (no streaming).
/// Used for commands like `terraform show -json` where we need the full JSON result.
pub async fn run_terraform_capture(
    working_dir: &Path,
    subcommand: &str,
    args: &[&str],
) -> Result<String, String> {
    let mut cmd = Command::new("terraform");
    cmd.arg(subcommand);
    cmd.args(args);
    cmd.current_dir(working_dir);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let output = cmd.output().await.map_err(|e| {
        format!(
            "Failed to run terraform {}: {}",
            subcommand, e
        )
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("terraform {} failed: {}", subcommand, stderr));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Validate result from `terraform validate -json` (single JSON blob, not streaming).
#[derive(Clone, Debug, Deserialize)]
pub struct TerraformValidateResult {
    #[serde(default)]
    pub valid: bool,
    #[serde(default)]
    pub error_count: u32,
    #[serde(default)]
    pub warning_count: u32,
    #[serde(default)]
    pub diagnostics: Vec<TerraformValidateDiagnostic>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct TerraformValidateDiagnostic {
    pub severity: String,
    pub summary: String,
    #[serde(default)]
    pub detail: Option<String>,
    #[serde(default)]
    pub range: Option<TerraformRange>,
}

/// Run `terraform validate -json`, which outputs a single JSON blob (not streaming).
/// Parses the result and converts it to TerraformJsonResult for consistent frontend handling.
pub async fn run_terraform_validate_json(
    app: &AppHandle,
    window_label: &str,
    working_dir: &Path,
) -> Result<TerraformJsonResult, String> {
    // Emit running status
    let _ = app.emit_to(
        window_label,
        "terraform:status",
        TerraformStatus {
            status: "running".into(),
            command: "validate".into(),
        },
    );

    let mut cmd = Command::new("terraform");
    cmd.arg("validate");
    cmd.arg("-json");
    cmd.current_dir(working_dir);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let output = cmd.output().await.map_err(|e| {
        format!("Failed to run terraform validate: {}", e)
    })?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    // Emit stdout/stderr for the terminal pane
    if !stdout.is_empty() {
        // Try to parse and emit human-readable diagnostics
        if let Ok(validate_result) = serde_json::from_str::<TerraformValidateResult>(&stdout) {
            for diag in &validate_result.diagnostics {
                let line = format!(
                    "{}: {}{}",
                    diag.severity,
                    diag.summary,
                    diag.detail.as_deref().map(|d| format!("\n  {}", d)).unwrap_or_default()
                );
                let stream = if diag.severity == "error" { "stderr" } else { "stdout" };
                let _ = app.emit_to(
                    window_label,
                    if stream == "stderr" { "terraform:stderr" } else { "terraform:stdout" },
                    TerraformOutput {
                        stream: stream.into(),
                        line,
                    },
                );
            }
        }
    }
    if !stderr.is_empty() {
        for line in stderr.lines() {
            let _ = app.emit_to(
                window_label,
                "terraform:stderr",
                TerraformOutput {
                    stream: "stderr".into(),
                    line: line.to_string(),
                },
            );
        }
    }

    let code = output.status.code().unwrap_or(-1);
    let success = output.status.success();

    // Emit completion status
    let _ = app.emit_to(
        window_label,
        "terraform:status",
        TerraformStatus {
            status: if success { "success".into() } else { "error".into() },
            command: "validate".into(),
        },
    );

    let exit = TerraformExit { code, success };
    let _ = app.emit_to(window_label, "terraform:exit", exit);

    // Parse the single JSON blob
    let validate_result: TerraformValidateResult = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse terraform validate JSON: {}", e))?;

    // Convert to TerraformJsonResult
    let diagnostics = validate_result
        .diagnostics
        .into_iter()
        .map(|d| TerraformDiagnostic {
            severity: d.severity,
            summary: d.summary,
            detail: d.detail.unwrap_or_default(),
            address: None,
            range: d.range,
        })
        .collect();

    Ok(TerraformJsonResult {
        success: validate_result.valid,
        code,
        diagnostics,
        resource_changes: vec![],
    })
}

/// Run a terraform command with -json flag, parsing each line and emitting structured events.
/// Returns aggregated result with diagnostics and resource change info.
/// Events are targeted to the specified window label so other windows are not affected.
pub async fn run_terraform_json(
    app: &AppHandle,
    window_label: &str,
    working_dir: &Path,
    subcommand: &str,
    args: &[&str],
) -> Result<TerraformJsonResult, String> {
    // Emit running status
    let _ = app.emit_to(
        window_label,
        "terraform:status",
        TerraformStatus {
            status: "running".into(),
            command: subcommand.into(),
        },
    );

    let mut cmd = Command::new("terraform");
    cmd.arg(subcommand);
    cmd.arg("-json");
    cmd.args(args);
    cmd.current_dir(working_dir);
    cmd.stdin(std::process::Stdio::null());
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let mut child = cmd.spawn().map_err(|e| {
        format!(
            "Failed to spawn terraform: {}. Is terraform installed and on your PATH?",
            e
        )
    })?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    let app_stdout = app.clone();
    let app_stderr = app.clone();
    let label_stdout = window_label.to_string();
    let label_stderr = window_label.to_string();

    // Collect diagnostics and resource changes
    let diagnostics = std::sync::Arc::new(std::sync::Mutex::new(Vec::<TerraformDiagnostic>::new()));
    let resource_changes = std::sync::Arc::new(std::sync::Mutex::new(Vec::<ResourceChangeInfo>::new()));

    let diag_clone = diagnostics.clone();
    let changes_clone = resource_changes.clone();

    // Process stdout JSON lines
    let stdout_task = tokio::spawn(async move {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            // Try to parse as JSON
            if let Ok(msg) = serde_json::from_str::<TerraformJsonMessage>(&line) {
                // Emit structured message for frontend
                let _ = app_stdout.emit_to(&label_stdout, "terraform:json", msg.clone());

                // Also emit human-readable line for the log
                let _ = app_stdout.emit_to(
                    &label_stdout,
                    "terraform:stdout",
                    TerraformOutput {
                        stream: "stdout".into(),
                        line: msg.message.clone(),
                    },
                );

                // Collect diagnostics (errors/warnings)
                if let Some(diag) = msg.diagnostic {
                    if let Ok(mut diags) = diag_clone.lock() {
                        diags.push(diag);
                    }
                }

                // Track resource changes
                if let Some(change) = msg.change {
                    if let Some(resource) = change.resource {
                        if let Ok(mut changes) = changes_clone.lock() {
                            let action = change.action.unwrap_or_else(|| "unknown".into());
                            let is_error = msg.msg_type == "apply_errored";
                            changes.push(ResourceChangeInfo {
                                address: resource.addr.clone(),
                                action,
                                success: !is_error,
                                error: if is_error {
                                    Some(msg.message.clone())
                                } else {
                                    None
                                },
                            });
                        }
                    }
                }

                // Handle apply_errored messages (resource-level errors)
                if msg.msg_type == "apply_errored" {
                    // These often have the resource address in the hook field
                    if let Some(hook) = &msg.hook {
                        if let Some(resource) = hook.get("resource") {
                            if let Some(addr) = resource.get("addr").and_then(|a| a.as_str()) {
                                if let Ok(mut changes) = changes_clone.lock() {
                                    // Check if we already have this resource, update it
                                    let existing = changes.iter_mut().find(|c| c.address == addr);
                                    if let Some(existing) = existing {
                                        existing.success = false;
                                        existing.error = Some(msg.message.clone());
                                    } else {
                                        changes.push(ResourceChangeInfo {
                                            address: addr.to_string(),
                                            action: "create".into(),
                                            success: false,
                                            error: Some(msg.message.clone()),
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                // Not valid JSON, emit as raw line
                let _ = app_stdout.emit_to(
                    &label_stdout,
                    "terraform:stdout",
                    TerraformOutput {
                        stream: "stdout".into(),
                        line,
                    },
                );
            }
        }
    });

    // Stderr might have non-JSON error messages
    let stderr_task = tokio::spawn(async move {
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_stderr.emit_to(
                &label_stderr,
                "terraform:stderr",
                TerraformOutput {
                    stream: "stderr".into(),
                    line,
                },
            );
        }
    });

    // Wait for process to complete
    let status = child
        .wait()
        .await
        .map_err(|e| format!("Failed to wait for terraform: {}", e))?;

    // Wait for output tasks to finish
    let _ = stdout_task.await;
    let _ = stderr_task.await;

    let code = status.code().unwrap_or(-1);
    let success = status.success();

    // Emit completion status
    let _ = app.emit_to(
        window_label,
        "terraform:status",
        TerraformStatus {
            status: if success {
                "success".into()
            } else {
                "error".into()
            },
            command: subcommand.into(),
        },
    );

    let exit = TerraformExit { code, success };
    let _ = app.emit_to(window_label, "terraform:exit", exit);

    // Extract collected data
    let final_diagnostics = diagnostics.lock().map(|d| d.clone()).unwrap_or_default();
    let final_changes = resource_changes.lock().map(|c| c.clone()).unwrap_or_default();

    Ok(TerraformJsonResult {
        success,
        code,
        diagnostics: final_diagnostics,
        resource_changes: final_changes,
    })
}

/// Run `terraform plan -json -out=tfplan`, collecting planned_change messages
/// with full before/after property diffs. Returns a `TerraformPlanResult`.
pub async fn run_terraform_json_plan(
    app: &AppHandle,
    window_label: &str,
    working_dir: &Path,
) -> Result<TerraformPlanResult, String> {
    let plan_file = working_dir.join("tfplan");
    let plan_file_str = plan_file.to_string_lossy().to_string();

    // Emit running status
    let _ = app.emit_to(
        window_label,
        "terraform:status",
        TerraformStatus {
            status: "running".into(),
            command: "plan".into(),
        },
    );

    let mut cmd = Command::new("terraform");
    cmd.arg("plan")
        .arg("-json")
        .arg(format!("-out={}", plan_file.display()));
    cmd.current_dir(working_dir);
    cmd.stdin(std::process::Stdio::null());
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let mut child = cmd.spawn().map_err(|e| {
        format!(
            "Failed to spawn terraform: {}. Is terraform installed and on your PATH?",
            e
        )
    })?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    let app_stdout = app.clone();
    let app_stderr = app.clone();
    let label_stdout = window_label.to_string();
    let label_stderr = window_label.to_string();

    let diagnostics = std::sync::Arc::new(std::sync::Mutex::new(Vec::<TerraformDiagnostic>::new()));
    let plan_changes = std::sync::Arc::new(std::sync::Mutex::new(Vec::<PlanResourceChange>::new()));

    let diag_clone = diagnostics.clone();
    let changes_clone = plan_changes.clone();

    // Process stdout JSON lines — look for planned_change messages
    let stdout_task = tokio::spawn(async move {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            // Try to parse the full JSON line for planned_change extraction
            if let Ok(raw) = serde_json::from_str::<serde_json::Value>(&line) {
                // Emit human-readable message for the terminal
                let message = raw.get("@message")
                    .and_then(|m| m.as_str())
                    .unwrap_or(&line)
                    .to_string();
                let _ = app_stdout.emit_to(
                    &label_stdout,
                    "terraform:stdout",
                    TerraformOutput {
                        stream: "stdout".into(),
                        line: message,
                    },
                );

                // Also emit structured JSON for frontend
                if let Ok(msg) = serde_json::from_str::<TerraformJsonMessage>(&line) {
                    let _ = app_stdout.emit_to(&label_stdout, "terraform:json", msg.clone());

                    // Collect diagnostics
                    if let Some(diag) = msg.diagnostic {
                        if let Ok(mut diags) = diag_clone.lock() {
                            diags.push(diag);
                        }
                    }
                }

                // Extract planned_change messages with before/after
                let msg_type = raw.get("type").and_then(|t| t.as_str()).unwrap_or("");
                if msg_type == "planned_change" {
                    if let Some(change) = raw.get("change") {
                        let address = change
                            .get("resource")
                            .and_then(|r| r.get("addr"))
                            .and_then(|a| a.as_str())
                            .unwrap_or("")
                            .to_string();
                        let module_address = change
                            .get("resource")
                            .and_then(|r| r.get("module"))
                            .and_then(|m| m.as_str())
                            .unwrap_or("")
                            .to_string();
                        let action = change
                            .get("action")
                            .and_then(|a| a.as_str())
                            .unwrap_or("unknown")
                            .to_string();
                        let before = change.get("before").cloned();
                        let after = change.get("after").cloned();

                        // Normalize action into actions array
                        let actions = if action == "replace" {
                            vec!["delete".to_string(), "create".to_string()]
                        } else {
                            vec![action]
                        };

                        if let Ok(mut changes) = changes_clone.lock() {
                            changes.push(PlanResourceChange {
                                address,
                                module_address,
                                actions,
                                before,
                                after,
                            });
                        }
                    }
                }
            } else {
                // Not valid JSON, emit as raw line
                let _ = app_stdout.emit_to(
                    &label_stdout,
                    "terraform:stdout",
                    TerraformOutput {
                        stream: "stdout".into(),
                        line,
                    },
                );
            }
        }
    });

    let stderr_task = tokio::spawn(async move {
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_stderr.emit_to(
                &label_stderr,
                "terraform:stderr",
                TerraformOutput {
                    stream: "stderr".into(),
                    line,
                },
            );
        }
    });

    let status = child
        .wait()
        .await
        .map_err(|e| format!("Failed to wait for terraform: {}", e))?;

    let _ = stdout_task.await;
    let _ = stderr_task.await;

    let code = status.code().unwrap_or(-1);
    // terraform plan exits with code 2 when there are changes (success)
    let success = code == 0 || code == 2;

    let _ = app.emit_to(
        window_label,
        "terraform:status",
        TerraformStatus {
            status: if success { "success".into() } else { "error".into() },
            command: "plan".into(),
        },
    );

    let exit = TerraformExit { code, success };
    let _ = app.emit_to(window_label, "terraform:exit", exit);

    let final_diagnostics = diagnostics.lock().map(|d| d.clone()).unwrap_or_default();
    let final_plan_changes = plan_changes.lock().map(|c| c.clone()).unwrap_or_default();

    Ok(TerraformPlanResult {
        success,
        code,
        diagnostics: final_diagnostics,
        plan_changes: final_plan_changes,
        plan_file_path: plan_file_str,
    })
}

/// Check if the terraform CLI is available on PATH.
pub async fn check_terraform_installed() -> Result<String, String> {
    let output = Command::new("terraform")
        .arg("version")
        .output()
        .await
        .map_err(|e| {
            format!(
                "Terraform not found: {}. Please install terraform and ensure it is on your PATH.",
                e
            )
        })?;

    if !output.status.success() {
        return Err("Terraform version check failed".into());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    // Return the first line (e.g., "Terraform v1.9.0")
    Ok(stdout.lines().next().unwrap_or("unknown").trim().to_string())
}

/// Run a terraform subcommand in the given working directory,
/// streaming output via Tauri events targeted to a specific window.
pub async fn run_terraform(
    app: &AppHandle,
    window_label: &str,
    working_dir: &Path,
    subcommand: &str,
    args: &[&str],
) -> Result<TerraformExit, String> {
    // Emit running status
    let _ = app.emit_to(
        window_label,
        "terraform:status",
        TerraformStatus {
            status: "running".into(),
            command: subcommand.into(),
        },
    );

    let mut cmd = Command::new("terraform");
    cmd.arg(subcommand);
    cmd.args(args);
    cmd.current_dir(working_dir);
    cmd.stdin(std::process::Stdio::null());
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    // On Windows, prevent a console window from flashing
    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let mut child = cmd.spawn().map_err(|e| {
        format!(
            "Failed to spawn terraform: {}. Is terraform installed and on your PATH?",
            e
        )
    })?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    let app_stdout = app.clone();
    let app_stderr = app.clone();
    let label_stdout = window_label.to_string();
    let label_stderr = window_label.to_string();

    // Spawn tasks to read stdout and stderr concurrently
    let stdout_task = tokio::spawn(async move {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_stdout.emit_to(
                &label_stdout,
                "terraform:stdout",
                TerraformOutput {
                    stream: "stdout".into(),
                    line,
                },
            );
        }
    });

    let stderr_task = tokio::spawn(async move {
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_stderr.emit_to(
                &label_stderr,
                "terraform:stderr",
                TerraformOutput {
                    stream: "stderr".into(),
                    line,
                },
            );
        }
    });

    // Wait for process to complete
    let status = child
        .wait()
        .await
        .map_err(|e| format!("Failed to wait for terraform: {}", e))?;

    // Wait for output tasks to finish
    let _ = stdout_task.await;
    let _ = stderr_task.await;

    let code = status.code().unwrap_or(-1);
    let success = status.success();

    // Emit completion status
    let _ = app.emit_to(
        window_label,
        "terraform:status",
        TerraformStatus {
            status: if success {
                "success".into()
            } else {
                "error".into()
            },
            command: subcommand.into(),
        },
    );

    let exit = TerraformExit { code, success };
    let _ = app.emit_to(window_label, "terraform:exit", exit.clone());

    Ok(exit)
}
