use serde::{Deserialize, Serialize};
use tauri::command;
use tokio::process::Command;

#[derive(Clone, Serialize, Deserialize)]
pub struct AzSubscription {
    pub id: String,
    pub name: String,
    #[serde(rename = "tenantId", default)]
    pub tenant_id: String,
    #[serde(rename = "isDefault", default)]
    pub is_default: bool,
    #[serde(default)]
    pub state: String,
}

#[derive(Clone, Serialize)]
pub struct AzListResult {
    pub status: String, // "ok" | "not_installed" | "not_logged_in" | "error"
    pub subscriptions: Vec<AzSubscription>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// List Azure subscriptions via `az account list`.
/// Never returns Err — status field encodes the outcome.
#[command]
pub async fn az_list_subscriptions() -> AzListResult {
    let mut cmd = build_az_command(&["account", "list", "--output", "json"]);

    let output = match cmd.output().await {
        Ok(o) => o,
        Err(e) => {
            let msg = e.to_string();
            // "program not found" / "No such file" → not installed
            if e.kind() == std::io::ErrorKind::NotFound
                || msg.contains("not found")
                || msg.contains("No such file")
            {
                return AzListResult {
                    status: "not_installed".into(),
                    subscriptions: vec![],
                    error: None,
                };
            }
            return AzListResult {
                status: "error".into(),
                subscriptions: vec![],
                error: Some(msg),
            };
        }
    };

    let stderr = String::from_utf8_lossy(&output.stderr).to_lowercase();
    let stdout = String::from_utf8_lossy(&output.stdout);

    // "Please run az login" → not authenticated at all
    let not_logged_in = stderr.contains("az login")
        || stderr.contains("please run")
        || stderr.contains("aadsts")
        || stderr.contains("not logged");

    // "No subscriptions found" → authenticated but subs are in a specific tenant
    // This is distinct from not being logged in — don't conflate them.
    let no_subs_warning = stderr.contains("no subscriptions found");

    if not_logged_in {
        return AzListResult {
            status: "not_logged_in".into(),
            subscriptions: vec![],
            error: None,
        };
    }

    if no_subs_warning {
        return AzListResult {
            status: "no_subscriptions".into(),
            subscriptions: vec![],
            error: None,
        };
    }

    // Non-zero exit + empty stdout with no known signal → treat as auth issue
    if !output.status.success() && stdout.trim().is_empty() {
        return AzListResult {
            status: "not_logged_in".into(),
            subscriptions: vec![],
            error: None,
        };
    }

    match serde_json::from_str::<Vec<AzSubscription>>(stdout.trim()) {
        Ok(subs) if subs.is_empty() => AzListResult {
            status: "no_subscriptions".into(),
            subscriptions: vec![],
            error: None,
        },
        Ok(subs) => AzListResult {
            status: "ok".into(),
            subscriptions: subs,
            error: None,
        },
        Err(e) => AzListResult {
            status: "error".into(),
            subscriptions: vec![],
            error: Some(format!("Failed to parse az output: {}", e)),
        },
    }
}

/// Build a `Command` for the `az` CLI, abstracting Windows vs Unix differences.
///
/// On Windows, `.cmd` scripts cannot be invoked directly — we go through `cmd.exe /c`.
fn build_az_command(args: &[&str]) -> Command {
    #[cfg(target_os = "windows")]
    {
        let mut cmd = Command::new("cmd");
        cmd.arg("/c").arg("az");
        cmd.args(args);
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        cmd
    }
    #[cfg(not(target_os = "windows"))]
    {
        let mut cmd = Command::new("az");
        cmd.args(args);
        cmd
    }
}
