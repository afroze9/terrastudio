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
