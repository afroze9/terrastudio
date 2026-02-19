use serde::Serialize;
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
/// streaming output via Tauri events.
pub async fn run_terraform(
    app: &AppHandle,
    working_dir: &Path,
    subcommand: &str,
    args: &[&str],
) -> Result<TerraformExit, String> {
    // Emit running status
    let _ = app.emit(
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

    // Spawn tasks to read stdout and stderr concurrently
    let stdout_task = tokio::spawn(async move {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_stdout.emit(
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
            let _ = app_stderr.emit(
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
    let _ = app.emit(
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
    let _ = app.emit("terraform:exit", exit.clone());

    Ok(exit)
}
