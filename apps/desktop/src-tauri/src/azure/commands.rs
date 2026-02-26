use serde::{Deserialize, Serialize};
use tauri::command;
use tokio::process::Command;

// ---------------------------------------------------------------------------
// Azure Retail Prices API proxy — bypasses browser CORS restrictions
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct RetailPriceItem {
    #[serde(rename = "retailPrice")]
    retail_price: f64,
    #[serde(rename = "skuName")]
    sku_name: String,
    #[serde(rename = "type")]
    price_type: String,
}

#[derive(Deserialize)]
struct RetailPricesResponse {
    #[serde(rename = "Items")]
    items: Vec<RetailPriceItem>,
}

/// Fetch the retail price from the Azure Retail Prices API.
/// Returns the retailPrice of the first matching Consumption item, or null.
/// This runs server-side to avoid browser CORS restrictions.
#[command]
pub async fn fetch_azure_price(
    service_name: String,
    arm_sku_name: String,
    region: String,
) -> Option<f64> {
    let filter = format!(
        "serviceName eq '{}' and armSkuName eq '{}' and armRegionName eq '{}' and priceType eq 'Consumption'",
        service_name, arm_sku_name, region
    );
    let url = format!(
        "https://prices.azure.com/api/retail/prices?$filter={}",
        urlencoding::encode(&filter)
    );

    let client = reqwest::Client::new();
    let resp = match client.get(&url).send().await {
        Ok(r) => r,
        Err(_) => return None,
    };

    let data: RetailPricesResponse = match resp.json().await {
        Ok(d) => d,
        Err(_) => return None,
    };

    // Pick first non-Spot, non-Low Priority Consumption item
    let item = data.items.iter().find(|i| {
        let sku_lower = i.sku_name.to_lowercase();
        !sku_lower.contains("spot")
            && !sku_lower.contains("low priority")
            && i.price_type == "Consumption"
    }).or_else(|| data.items.first())?;

    Some(item.retail_price)
}

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
