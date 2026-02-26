import { fetchMonthlyPrice } from '$lib/services/pricing-service';
import type { CostCalculator } from '../index';

// SQL Database DTU-based SKU approximate monthly rates (East US, pay-as-you-go)
const SQL_DTU_RATES: Record<string, number> = {
  Basic: 4.99,
  S0: 14.72,
  S1: 29.44,
  S2: 58.88,
  S3: 117.76,
  P1: 456.0,
  P2: 912.0,
  P4: 1824.0,
};

/**
 * Convert Terraform sku_name (e.g. "GP_Gen5_2") to Azure Retail API armSkuName.
 * Pattern: {tier}_Gen{gen}_{vcores} → SQLDB_{TIER}_Compute_Gen{gen}_{vcores}
 * The API price is per-vCore-per-hour, so caller must multiply by vCore count × 730.
 */
function sqlVcoreArmSku(skuName: string): { armSku: string; vCores: number } | null {
  // e.g. "GP_Gen5_2" or "BC_Gen5_4" or "HS_Gen5_2"
  const match = skuName.match(/^(GP|BC|HS|GP_S)_Gen(\d+)_(\d+)$/i);
  if (!match) return null;
  const tier = match[1].toUpperCase().replace('_S', ''); // serverless → GP
  const gen = match[2];
  const vcores = parseInt(match[3], 10);
  const tierMap: Record<string, string> = { GP: 'GP', BC: 'BC', HS: 'HS' };
  const apiTier = tierMap[tier] ?? 'GP';
  return { armSku: `SQLDB_${apiTier}_Compute_Gen${gen}_${vcores}`, vCores: vcores };
}

export const mssqlDatabaseCostCalculator: CostCalculator = async (properties, region) => {
  const skuName = (properties.sku_name as string | undefined) ?? 'S0';

  // Static lookup for DTU-based tiers (faster, no API call)
  const staticRate = SQL_DTU_RATES[skuName];
  if (staticRate !== undefined) {
    return {
      monthly: staticRate,
      breakdown: [{ label: `SQL Database (${skuName})`, cost: staticRate }],
    };
  }

  // vCore tiers: convert sku_name to armSkuName and call API
  const vcore = sqlVcoreArmSku(skuName);
  if (vcore) {
    // API returns price per vCore per hour — multiply by vCores × 730 hrs/month
    const pricePerVCorePerHour = await fetchMonthlyPrice('SQL Database', vcore.armSku, region);
    if (pricePerVCorePerHour !== null) {
      // fetchMonthlyPrice multiplies by 730 for hourly services — but SQL is NOT in the
      // isHourly list in pricing-service, so we get the raw per-vCore-per-hour rate.
      // Multiply here: rate × vCores × 730
      const monthly = Math.round(pricePerVCorePerHour * vcore.vCores * 730 * 100) / 100;
      return {
        monthly,
        breakdown: [{ label: `SQL Database (${skuName}, ${vcore.vCores} vCores)`, cost: monthly }],
      };
    }
  }

  return { monthly: null, breakdown: [] };
};

// CosmosDB: ~$0.008/RU/hr for manual throughput + $0.25/GB/month storage
const COSMOS_RU_RATE_PER_HOUR = 0.008 / 100; // per 100 RU/s per hour
const COSMOS_STORAGE_RATE_PER_GB = 0.25;
const COSMOS_DEFAULT_RUS = 400;
const COSMOS_DEFAULT_STORAGE_GB = 10;

export const cosmosDbCostCalculator: CostCalculator = async (properties) => {
  const rus = typeof properties._cost_rus === 'number' ? properties._cost_rus : COSMOS_DEFAULT_RUS;
  const storageGb = typeof properties._cost_storage_gb === 'number' ? properties._cost_storage_gb : COSMOS_DEFAULT_STORAGE_GB;

  const throughputCost = Math.round(rus * COSMOS_RU_RATE_PER_HOUR * 730 * 100) / 100;
  const storageCost = Math.round(storageGb * COSMOS_STORAGE_RATE_PER_GB * 100) / 100;
  const monthly = throughputCost + storageCost;

  return {
    monthly,
    breakdown: [
      { label: `Throughput (${rus} RU/s × $${(COSMOS_RU_RATE_PER_HOUR * 730).toFixed(4)}/RU-month)`, cost: throughputCost },
      { label: `Storage (${storageGb} GB × $${COSMOS_STORAGE_RATE_PER_GB}/GB)`, cost: storageCost },
    ],
  };
};

// PostgreSQL Flexible Server compute rates (East US, pay-as-you-go, per-month)
// Maps Terraform sku_name → approximate monthly compute cost (1 instance)
// Rates derived from Azure pricing page vCore × $0.089–0.178/hr × 730
const PSQL_COMPUTE_RATES: Record<string, number> = {
  // Burstable B-series
  'B_Standard_B1ms':   12.41,
  'B_Standard_B2s':    24.82,
  'B_Standard_B2ms':   36.50,
  'B_Standard_B4ms':   73.00,
  'B_Standard_B8ms':   146.00,
  'B_Standard_B12ms':  219.00,
  'B_Standard_B16ms':  292.00,
  // General Purpose D-series v3/v4/v5 (2 vCore = ~$0.089/vCore/hr × 2 × 730)
  'GP_Standard_D2s_v3':   130.0,
  'GP_Standard_D4s_v3':   260.0,
  'GP_Standard_D8s_v3':   520.0,
  'GP_Standard_D16s_v3':  1040.0,
  'GP_Standard_D32s_v3':  2080.0,
  'GP_Standard_D2ds_v4':  130.0,
  'GP_Standard_D4ds_v4':  260.0,
  'GP_Standard_D8ds_v4':  520.0,
  'GP_Standard_D16ds_v4': 1040.0,
  'GP_Standard_D2ds_v5':  130.0,
  'GP_Standard_D4ds_v5':  260.0,
  'GP_Standard_D8ds_v5':  520.0,
  'GP_Standard_D16ds_v5': 1040.0,
  'GP_Standard_D32ds_v5': 2080.0,
  // Memory Optimized E-series
  'MO_Standard_E2ds_v4':  184.0,
  'MO_Standard_E4ds_v4':  368.0,
  'MO_Standard_E8ds_v4':  736.0,
  'MO_Standard_E16ds_v4': 1472.0,
  'MO_Standard_E2ds_v5':  184.0,
  'MO_Standard_E4ds_v5':  368.0,
  'MO_Standard_E8ds_v5':  736.0,
  'MO_Standard_E16ds_v5': 1472.0,
};

// PostgreSQL storage rates: ~$0.115/GB/month for provisioned storage, $0.095/GB for backup overage
const PSQL_STORAGE_RATE_PER_GB = 0.115;
const PSQL_BACKUP_OVERAGE_RATE = 0.095;

export const postgresqlCostCalculator: CostCalculator = async (properties) => {
  const skuName = (properties.sku_name as string | undefined) ?? 'GP_Standard_D2s_v3';
  const storageMb = Number(properties.storage_mb ?? 32768);
  const storageGb = storageMb / 1024;
  const backupOverageGb = typeof properties._cost_backup_storage_gb === 'number'
    ? properties._cost_backup_storage_gb
    : 0;

  const computePrice = PSQL_COMPUTE_RATES[skuName] ?? null;
  if (computePrice === null) return { monthly: null, breakdown: [] };

  const storageCost = Math.round(storageGb * PSQL_STORAGE_RATE_PER_GB * 100) / 100;
  const backupCost = Math.round(backupOverageGb * PSQL_BACKUP_OVERAGE_RATE * 100) / 100;
  const monthly = computePrice + storageCost + backupCost;

  return {
    monthly,
    breakdown: [
      { label: `Compute (${skuName})`, cost: computePrice },
      { label: `Storage (${storageGb} GB × $${PSQL_STORAGE_RATE_PER_GB}/GB)`, cost: storageCost },
      ...(backupCost > 0 ? [{ label: `Backup overage (${backupOverageGb} GB × $${PSQL_BACKUP_OVERAGE_RATE}/GB)`, cost: backupCost }] : []),
    ],
  };
};

// Key Vault: $0.03 per 10,000 operations, $3 per certificate renewal
// Premium SKU adds ~$1 overhead for HSM-backed key management
const KV_RATE_PER_10K_OPS = 0.03;
const KV_CERT_RENEWAL_RATE = 3.0;

export const keyVaultCostCalculator: CostCalculator = async (properties) => {
  const sku = (properties.sku_name as string | undefined) ?? 'standard';
  const operations10k = typeof properties._cost_operations_10k === 'number'
    ? properties._cost_operations_10k
    : 100;
  const certRenewals = typeof properties._cost_certificates === 'number'
    ? properties._cost_certificates
    : 0;

  const opsCost = Math.round(operations10k * KV_RATE_PER_10K_OPS * 100) / 100;
  const certCost = Math.round(certRenewals * KV_CERT_RENEWAL_RATE * 100) / 100;
  const premiumBase = sku === 'premium' ? 1.0 : 0;
  const monthly = opsCost + certCost + premiumBase;

  return {
    monthly,
    breakdown: [
      { label: `Operations (${operations10k}k × $${KV_RATE_PER_10K_OPS}/10k)`, cost: opsCost },
      ...(certCost > 0 ? [{ label: `Certificate renewals (${certRenewals} × $${KV_CERT_RENEWAL_RATE})`, cost: certCost }] : []),
      ...(premiumBase > 0 ? [{ label: 'Premium HSM overhead', cost: premiumBase }] : []),
    ],
  };
};

// Redis Cache approximate monthly rates
const REDIS_RATES: Record<string, number> = {
  C0: 16.06,
  C1: 53.29,
  C2: 105.12,
  C3: 209.95,
  P1: 163.87,
  P2: 327.74,
};

export const redisCacheCostCalculator: CostCalculator = async (properties) => {
  const family = (properties.family as string | undefined) ?? 'C';
  const capacity = (properties.capacity as number | undefined) ?? 0;
  const key = `${family}${capacity}`;

  const rate = REDIS_RATES[key];
  if (rate === undefined) return { monthly: null, breakdown: [] };

  return {
    monthly: rate,
    breakdown: [{ label: `Redis Cache (${key})`, cost: rate }],
  };
};
