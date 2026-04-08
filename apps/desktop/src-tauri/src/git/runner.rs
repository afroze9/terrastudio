use serde::Serialize;
use std::path::Path;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

#[derive(Clone, Serialize)]
pub struct GitOutput {
    pub stream: String,
    pub line: String,
}

#[derive(Clone, Serialize)]
pub struct GitExit {
    pub code: i32,
    pub success: bool,
}

/// Run a git command and capture all output (no streaming).
/// Used for most git commands where we need the full result at once.
pub async fn run_git_capture(
    working_dir: &Path,
    args: &[&str],
) -> Result<String, String> {
    let mut cmd = Command::new("git");
    cmd.args(args);
    cmd.current_dir(working_dir);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let output = cmd.output().await.map_err(|e| {
        format!("Failed to run git {}: {}", args.first().unwrap_or(&""), e)
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "git {} failed: {}",
            args.first().unwrap_or(&""),
            stderr.trim()
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// Run a git command and capture output, returning Ok even on non-zero exit.
/// Used for commands where failure is expected (e.g., remote status with no upstream).
pub async fn run_git_capture_lenient(
    working_dir: &Path,
    args: &[&str],
) -> Result<(String, String, bool), String> {
    let mut cmd = Command::new("git");
    cmd.args(args);
    cmd.current_dir(working_dir);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let output = cmd.output().await.map_err(|e| {
        format!("Failed to run git {}: {}", args.first().unwrap_or(&""), e)
    })?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let success = output.status.success();

    Ok((stdout, stderr, success))
}

/// Run a git command with streaming output via Tauri events.
/// Used for long-running operations like push/pull.
pub async fn run_git(
    app: &AppHandle,
    window_label: &str,
    working_dir: &Path,
    args: &[&str],
) -> Result<GitExit, String> {
    let mut cmd = Command::new("git");
    cmd.args(args);
    cmd.current_dir(working_dir);
    cmd.stdin(std::process::Stdio::null());
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let mut child = cmd.spawn().map_err(|e| {
        format!(
            "Failed to spawn git: {}. Is git installed and on your PATH?",
            e
        )
    })?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    let app_stdout = app.clone();
    let app_stderr = app.clone();
    let label_stdout = window_label.to_string();
    let label_stderr = window_label.to_string();

    let stdout_task = tokio::spawn(async move {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_stdout.emit_to(
                &label_stdout,
                "git:stdout",
                GitOutput {
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
                "git:stderr",
                GitOutput {
                    stream: "stderr".into(),
                    line,
                },
            );
        }
    });

    let status = child
        .wait()
        .await
        .map_err(|e| format!("Failed to wait for git: {}", e))?;

    let _ = stdout_task.await;
    let _ = stderr_task.await;

    let code = status.code().unwrap_or(-1);
    let success = status.success();

    let exit = GitExit { code, success };
    let _ = app.emit_to(window_label, "git:exit", exit.clone());

    Ok(exit)
}

/// Check if git is available on PATH.
pub async fn check_git_installed() -> Result<String, String> {
    let output = Command::new("git")
        .arg("--version")
        .output()
        .await
        .map_err(|e| {
            format!(
                "Git not found: {}. Please install git and ensure it is on your PATH.",
                e
            )
        })?;

    if !output.status.success() {
        return Err("Git version check failed".into());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.lines().next().unwrap_or("unknown").trim().to_string())
}
