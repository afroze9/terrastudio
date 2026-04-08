use serde::Serialize;
use std::path::PathBuf;
use tauri::{command, AppHandle, WebviewWindow};

use super::runner;
use crate::security;

#[derive(Clone, Serialize)]
pub struct GitFileStatus {
    /// Status code: "A" = added, "M" = modified, "D" = deleted, "?" = untracked, "R" = renamed
    pub status: String,
    /// File path relative to the repo root
    pub path: String,
}

#[derive(Clone, Serialize)]
pub struct GitLogEntry {
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub date: String,
    pub author: String,
}

#[derive(Clone, Serialize)]
pub struct GitRemoteStatus {
    pub ahead: u32,
    pub behind: u32,
    pub has_remote: bool,
}

// --- Sanitization helpers ---

/// Validate a git ref string (commit hash, branch name, HEAD~1, etc.).
/// Allows alphanumeric, dots, hyphens, underscores, forward slashes, tildes, carets.
fn sanitize_ref(ref_str: &str) -> Result<&str, String> {
    if ref_str.is_empty() {
        return Err("Git ref cannot be empty".to_string());
    }
    if ref_str.contains('\0') {
        return Err("Git ref contains null byte".to_string());
    }
    for ch in ref_str.chars() {
        if !ch.is_alphanumeric()
            && ch != '.'
            && ch != '-'
            && ch != '_'
            && ch != '/'
            && ch != '~'
            && ch != '^'
        {
            return Err(format!(
                "Git ref contains invalid character '{}': {}",
                ch, ref_str
            ));
        }
    }
    Ok(ref_str)
}

/// Validate a branch name. Allows alphanumeric, dots, hyphens, underscores, forward slashes.
fn sanitize_branch_name(name: &str) -> Result<&str, String> {
    if name.is_empty() {
        return Err("Branch name cannot be empty".to_string());
    }
    if name.contains('\0') {
        return Err("Branch name contains null byte".to_string());
    }
    for ch in name.chars() {
        if !ch.is_alphanumeric() && ch != '.' && ch != '-' && ch != '_' && ch != '/' {
            return Err(format!(
                "Branch name contains invalid character '{}': {}",
                ch, name
            ));
        }
    }
    if name.starts_with('-') || name.starts_with('.') {
        return Err(format!("Branch name cannot start with '{}': {}", &name[..1], name));
    }
    if name.contains("..") {
        return Err(format!("Branch name cannot contain '..': {}", name));
    }
    Ok(name)
}

/// Validate a commit message. Reject null bytes and enforce max length.
fn sanitize_commit_message(msg: &str) -> Result<&str, String> {
    if msg.trim().is_empty() {
        return Err("Commit message cannot be empty".to_string());
    }
    if msg.contains('\0') {
        return Err("Commit message contains null byte".to_string());
    }
    if msg.len() > 5000 {
        return Err("Commit message exceeds maximum length of 5000 characters".to_string());
    }
    Ok(msg)
}

// --- Commands ---

/// Check if the project directory is a git repository.
#[command]
pub async fn git_is_repo(project_path: String) -> bool {
    let git_dir = PathBuf::from(&project_path).join(".git");
    git_dir.exists()
}

/// Initialize a new git repository and create .gitignore.
#[command]
pub async fn git_init(project_path: String) -> Result<bool, String> {
    let project_dir = PathBuf::from(&project_path);

    // Run git init
    runner::run_git_capture(&project_dir, &["init"]).await?;

    // Write .gitignore
    let gitignore_content = r#"# Terraform working files
terraform/.terraform/
terraform/*.tfstate
terraform/*.tfstate.backup
terraform/.terraform.lock.hcl
terraform/terraform.tfvars
terraform/tfplan

# OS files
.DS_Store
Thumbs.db
"#;

    let gitignore_path = project_dir.join(".gitignore");
    tokio::fs::write(&gitignore_path, gitignore_content)
        .await
        .map_err(|e| format!("Failed to write .gitignore: {}", e))?;

    Ok(true)
}

/// Get the current git status (porcelain format), parsed into file statuses.
#[command]
pub async fn git_status(project_path: String) -> Result<Vec<GitFileStatus>, String> {
    let project_dir = PathBuf::from(&project_path);
    let output = runner::run_git_capture(&project_dir, &["status", "--porcelain"]).await?;

    let mut files = Vec::new();
    for line in output.lines() {
        if line.len() < 3 {
            continue;
        }
        let status_code = line[..2].trim();
        let path = line[3..].to_string();

        let status = match status_code {
            "??" => "?",
            s if s.contains('A') => "A",
            s if s.contains('M') => "M",
            s if s.contains('D') => "D",
            s if s.contains('R') => "R",
            _ => status_code,
        };

        files.push(GitFileStatus {
            status: status.to_string(),
            path,
        });
    }

    Ok(files)
}

/// Stage all changes and commit with the given message.
#[command]
pub async fn git_commit(project_path: String, message: String) -> Result<bool, String> {
    let project_dir = PathBuf::from(&project_path);
    sanitize_commit_message(&message)?;

    // Stage all changes
    runner::run_git_capture(&project_dir, &["add", "-A"]).await?;

    // Commit
    runner::run_git_capture(&project_dir, &["commit", "-m", &message]).await?;

    Ok(true)
}

/// Get recent commit history.
#[command]
pub async fn git_log(project_path: String, count: Option<u32>) -> Result<Vec<GitLogEntry>, String> {
    let project_dir = PathBuf::from(&project_path);
    let n = count.unwrap_or(50).min(200).to_string();

    // Use a delimiter that won't appear in commit messages
    let format = "%H\x1f%h\x1f%s\x1f%ai\x1f%an";
    let (output, _, success) = runner::run_git_capture_lenient(
        &project_dir,
        &["log", &format!("--format={}", format), &format!("-n{}", n)],
    )
    .await?;

    if !success || output.is_empty() {
        // No commits yet or not a git repo
        return Ok(vec![]);
    }

    let mut entries = Vec::new();
    for line in output.lines() {
        let parts: Vec<&str> = line.split('\x1f').collect();
        if parts.len() >= 5 {
            entries.push(GitLogEntry {
                hash: parts[0].to_string(),
                short_hash: parts[1].to_string(),
                message: parts[2].to_string(),
                date: parts[3].to_string(),
                author: parts[4].to_string(),
            });
        }
    }

    Ok(entries)
}

/// Get file content at a specific commit ref.
#[command]
pub async fn git_show_file(
    project_path: String,
    git_ref: String,
    file_path: String,
) -> Result<String, String> {
    let project_dir = PathBuf::from(&project_path);
    sanitize_ref(&git_ref)?;
    security::sanitize_filepath(&file_path)?;

    // Normalize to forward slashes for git
    let normalized_path = file_path.replace('\\', "/");
    let spec = format!("{}:{}", git_ref, normalized_path);

    runner::run_git_capture(&project_dir, &["show", &spec]).await
}

/// Push to the configured remote (streaming output).
#[command]
pub async fn git_push(
    app: AppHandle,
    window: WebviewWindow,
    project_path: String,
) -> Result<bool, String> {
    let project_dir = PathBuf::from(&project_path);
    let result = runner::run_git(&app, window.label(), &project_dir, &["push"]).await?;
    Ok(result.success)
}

/// Pull from remote (fast-forward only, streaming output).
#[command]
pub async fn git_pull(
    app: AppHandle,
    window: WebviewWindow,
    project_path: String,
) -> Result<bool, String> {
    let project_dir = PathBuf::from(&project_path);
    let result =
        runner::run_git(&app, window.label(), &project_dir, &["pull", "--ff-only"]).await?;
    Ok(result.success)
}

/// List all branches (local and remote).
#[command]
pub async fn git_branch_list(project_path: String) -> Result<Vec<String>, String> {
    let project_dir = PathBuf::from(&project_path);
    let output = runner::run_git_capture(&project_dir, &["branch", "-a"]).await?;

    let branches = output
        .lines()
        .map(|line| {
            line.trim()
                .trim_start_matches("* ")
                .trim_start_matches("remotes/origin/")
                .to_string()
        })
        .filter(|b| !b.contains("HEAD ->") && !b.is_empty())
        .collect::<Vec<_>>();

    // Deduplicate (local and remote may share names)
    let mut unique = Vec::new();
    for branch in branches {
        if !unique.contains(&branch) {
            unique.push(branch);
        }
    }

    Ok(unique)
}

/// Create a new branch and switch to it.
#[command]
pub async fn git_branch_create(project_path: String, name: String) -> Result<bool, String> {
    let project_dir = PathBuf::from(&project_path);
    sanitize_branch_name(&name)?;
    runner::run_git_capture(&project_dir, &["checkout", "-b", &name]).await?;
    Ok(true)
}

/// Switch to an existing branch.
#[command]
pub async fn git_branch_switch(project_path: String, name: String) -> Result<bool, String> {
    let project_dir = PathBuf::from(&project_path);
    sanitize_branch_name(&name)?;
    runner::run_git_capture(&project_dir, &["checkout", &name]).await?;
    Ok(true)
}

/// Get ahead/behind counts relative to the upstream branch.
#[command]
pub async fn git_remote_status(project_path: String) -> Result<GitRemoteStatus, String> {
    let project_dir = PathBuf::from(&project_path);

    let (output, _, success) = runner::run_git_capture_lenient(
        &project_dir,
        &["rev-list", "--left-right", "--count", "HEAD...@{u}"],
    )
    .await?;

    if !success {
        // No upstream configured
        return Ok(GitRemoteStatus {
            ahead: 0,
            behind: 0,
            has_remote: false,
        });
    }

    let parts: Vec<&str> = output.split_whitespace().collect();
    let ahead = parts.first().and_then(|s| s.parse().ok()).unwrap_or(0);
    let behind = parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(0);

    Ok(GitRemoteStatus {
        ahead,
        behind,
        has_remote: true,
    })
}

/// Get the current branch name.
#[command]
pub async fn git_current_branch(project_path: String) -> Result<String, String> {
    let project_dir = PathBuf::from(&project_path);
    runner::run_git_capture(&project_dir, &["rev-parse", "--abbrev-ref", "HEAD"]).await
}
