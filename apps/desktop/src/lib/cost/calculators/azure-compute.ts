import { fetchMonthlyPrice } from '$lib/services/pricing-service';
import type { CostCalculator } from '../index';

export const vmCostCalculator: CostCalculator = async (properties, region) => {
  const size = (properties.size as string | undefined) ?? 'Standard_B2s';
  const diskType = (properties.os_disk_type as string | undefined) ?? 'Standard_LRS';
  const diskSizeGb = (properties.os_disk_size_gb as number | undefined) ?? 30;
  const dataDiskCount = typeof properties._cost_data_disk_count === 'number'
    ? Math.max(0, Math.round(properties._cost_data_disk_count))
    : 0;

  const [computePrice, osDiskPrice] = await Promise.all([
    fetchMonthlyPrice('Virtual Machines', size, region),
    fetchDiskPrice(diskType, diskSizeGb),
  ]);

  const breakdown: { label: string; cost: number }[] = [];
  let monthly = 0;

  if (computePrice !== null) {
    breakdown.push({ label: `Compute (${size})`, cost: computePrice });
    monthly += computePrice;
  }
  if (osDiskPrice !== null) {
    breakdown.push({ label: `OS Disk (${diskSizeGb} GB ${diskType})`, cost: osDiskPrice });
    monthly += osDiskPrice;
    if (dataDiskCount > 0) {
      const dataDiskCost = osDiskPrice * dataDiskCount;
      breakdown.push({ label: `Data Disks (${dataDiskCount} × ${diskSizeGb} GB ${diskType})`, cost: dataDiskCost });
      monthly += dataDiskCost;
    }
  }

  return {
    monthly: computePrice !== null ? monthly : null,
    breakdown,
  };
};

function fetchDiskPrice(diskType: string, sizeGb: number): number | null {
  // Per-GB monthly rates (East US, managed disk approximations)
  // Standard HDD: $0.04/GB, Standard SSD: $0.075/GB, Premium SSD: $0.135/GB
  const ratePerGb: Record<string, number> = {
    Standard_LRS: 0.04,
    StandardSSD_LRS: 0.075,
    Premium_LRS: 0.135,
  };
  const rate = ratePerGb[diskType];
  if (rate === undefined) return null;
  return sizeGb * rate;
}

// Container Registry monthly base prices (East US, pay-as-you-go):
//   Basic:    ~$0.167/day × 30 = ~$5/mo   (10 GB included, extra $0.003/GB/day)
//   Standard: ~$0.667/day × 30 = ~$20/mo  (100 GB included, extra $0.003/GB/day)
//   Premium:  ~$1.667/day × 30 = ~$50/mo  (500 GB included, extra $0.003/GB/day)
const ACR_BASE_RATES: Record<string, number> = {
  Basic:    5.0,
  Standard: 20.0,
  Premium:  50.0,
};
const ACR_INCLUDED_STORAGE_GB: Record<string, number> = {
  Basic:    10,
  Standard: 100,
  Premium:  500,
};
// Overage: ~$0.003/GB/day × 30 = $0.09/GB/month
const ACR_OVERAGE_RATE_PER_GB = 0.09;

export const containerRegistryCostCalculator: CostCalculator = async (properties) => {
  const sku = (properties.sku as string | undefined) ?? 'Basic';
  const storageGb = typeof properties._cost_storage_gb === 'number'
    ? properties._cost_storage_gb
    : (ACR_INCLUDED_STORAGE_GB[sku] ?? 10);

  const baseCost = ACR_BASE_RATES[sku] ?? ACR_BASE_RATES['Basic'];
  const includedGb = ACR_INCLUDED_STORAGE_GB[sku] ?? 10;
  const overageGb = Math.max(0, storageGb - includedGb);
  const overageCost = Math.round(overageGb * ACR_OVERAGE_RATE_PER_GB * 100) / 100;
  const monthly = baseCost + overageCost;

  return {
    monthly,
    breakdown: [
      { label: `Container Registry ${sku} (${includedGb} GB incl.)`, cost: baseCost },
      ...(overageCost > 0 ? [{ label: `Storage overage (${overageGb} GB × $${ACR_OVERAGE_RATE_PER_GB}/GB)`, cost: overageCost }] : []),
    ],
  };
};

// Azure Retail Prices API armSkuName for App Service Premium v3 plans.
// B/S/P1v2 tiers have empty armSkuName in the API — use static fallback rates instead.
const ASP_ARM_SKU: Record<string, { linux: string; windows: string }> = {
  P1v3: {
    linux:   'Azure_App_Service_Premium_v3_Plan_Linux_P1_v3',
    windows: 'Standard_P1_v3_Windows',
  },
  P2v3: {
    linux:   'Azure_App_Service_Premium_v3_Plan_Linux_P2_v3',
    windows: 'Standard_P2_v3_Windows',
  },
  P3v3: {
    linux:   'Azure_App_Service_Premium_v3_Plan_Linux_P3_v3',
    windows: 'Standard_P3_v3_Windows',
  },
};

// Static monthly rates (East US, pay-as-you-go) for SKUs with empty armSkuName.
// Source: Azure pricing page — Linux / Windows per instance.
const ASP_STATIC_RATES: Record<string, { linux: number; windows: number }> = {
  B1:  { linux:  12.41, windows:  54.75 },
  B2:  { linux:  24.82, windows: 109.50 },
  B3:  { linux:  49.64, windows: 219.00 },
  S1:  { linux:  69.35, windows:  73.00 },
  S2:  { linux: 138.70, windows: 146.00 },
  S3:  { linux: 277.40, windows: 292.00 },
};

export const appServicePlanCostCalculator: CostCalculator = async (properties, region) => {
  const skuName = (properties.sku_name as string | undefined) ?? 'B1';
  const workerCount = (properties.worker_count as number | undefined) ?? 1;
  const osType = ((properties.os_type as string | undefined) ?? 'Linux').toLowerCase() as 'linux' | 'windows';

  // Y1 (Consumption) and F1 (Free) are usage-based / free
  if (skuName === 'Y1' || skuName === 'F1') {
    return { monthly: null, breakdown: [] };
  }

  let unitPrice: number | null = null;

  // Try API lookup for Premium v3 (they have proper armSkuName values)
  const armSku = ASP_ARM_SKU[skuName];
  if (armSku) {
    const armSkuName = osType === 'windows' ? armSku.windows : armSku.linux;
    unitPrice = await fetchMonthlyPrice('Azure App Service', armSkuName, region);
  }

  // Fall back to static rates for B/S tiers (armSkuName is empty in API)
  if (unitPrice === null) {
    const staticRate = ASP_STATIC_RATES[skuName];
    if (staticRate) {
      unitPrice = osType === 'windows' ? staticRate.windows : staticRate.linux;
    }
  }

  if (unitPrice === null) return { monthly: null, breakdown: [] };

  const monthly = unitPrice * workerCount;
  const breakdown = [
    { label: `${skuName} ${osType === 'windows' ? 'Windows' : 'Linux'} × ${workerCount} instance${workerCount !== 1 ? 's' : ''}`, cost: monthly },
  ];

  return { monthly, breakdown };
};
