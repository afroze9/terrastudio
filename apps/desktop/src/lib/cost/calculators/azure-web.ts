import type { CostCalculator } from '../index';

// Event Hub Namespace monthly rates by tier (East US)
//   Basic:    ~$0.015/hr (~$11/mo) per TU
//   Standard: ~$0.03/hr (~$22/mo) per TU
//   Premium:  ~$0.90/hr (~$657/mo) per PU
const EVENTHUB_RATES: Record<string, number> = {
  Basic: 11.0,
  Standard: 22.0,
  Premium: 657.0,
};

export const eventhubNamespaceCostCalculator: CostCalculator = async (properties) => {
  const sku = (properties.sku as string | undefined) ?? 'Standard';
  const capacity = Math.max(1, Number(properties.capacity ?? 1));

  const unitRate = EVENTHUB_RATES[sku] ?? EVENTHUB_RATES['Standard'];
  const monthly = unitRate * capacity;
  const unitLabel = sku === 'Premium' ? 'PU' : 'TU';

  return {
    monthly,
    breakdown: [
      { label: `Event Hub ${sku} (${capacity} ${unitLabel})`, cost: monthly },
    ],
  };
};

// CDN Profile monthly rates by SKU (East US)
//   Standard_Microsoft: ~$0.081/GB (first 10 TB)
//   Standard_Verizon:   ~$0.081/GB
//   Premium_Verizon:    ~$0.135/GB
// Base cost is effectively usage-based, but we estimate with assumed transfer
const CDN_RATE_PER_GB: Record<string, number> = {
  Standard_Microsoft: 0.081,
  Standard_Verizon: 0.081,
  Premium_Verizon: 0.135,
};
const CDN_DEFAULT_GB = 100;

export const cdnProfileCostCalculator: CostCalculator = async (properties) => {
  const sku = (properties.sku as string | undefined) ?? 'Standard_Microsoft';
  const dataGb = typeof properties._cost_data_gb === 'number' ? properties._cost_data_gb : CDN_DEFAULT_GB;

  const rate = CDN_RATE_PER_GB[sku] ?? CDN_RATE_PER_GB['Standard_Microsoft'];
  const monthly = Math.round(dataGb * rate * 100) / 100;

  return {
    monthly,
    breakdown: [
      { label: `CDN ${sku} (${dataGb} GB × $${rate}/GB)`, cost: monthly },
    ],
  };
};

// Azure Front Door monthly rates by tier (East US)
//   Standard: ~$35/mo base + $0.018/GB routing + $0.009/GB transfer
//   Premium:  ~$330/mo base + $0.024/GB routing + $0.012/GB transfer
const FRONTDOOR_RATES: Record<string, { base: number; routing: number; transfer: number }> = {
  Standard: { base: 35.0, routing: 0.018, transfer: 0.009 },
  Premium: { base: 330.0, routing: 0.024, transfer: 0.012 },
};

export const frontdoorProfileCostCalculator: CostCalculator = async (properties) => {
  const tier = (properties.sku_name as string | undefined) ?? 'Standard_AzureFrontDoor';
  const skuKey = tier.includes('Premium') ? 'Premium' : 'Standard';
  const dataGb = typeof properties._cost_data_gb === 'number' ? properties._cost_data_gb : 100;

  const rates = FRONTDOOR_RATES[skuKey];
  const routingCost = Math.round(dataGb * rates.routing * 100) / 100;
  const transferCost = Math.round(dataGb * rates.transfer * 100) / 100;
  const monthly = rates.base + routingCost + transferCost;

  return {
    monthly,
    breakdown: [
      { label: `Front Door ${skuKey} (base)`, cost: rates.base },
      { label: `Routing (${dataGb} GB)`, cost: routingCost },
      { label: `Transfer (${dataGb} GB)`, cost: transferCost },
    ],
  };
};

// Static Web App tiers (East US)
//   Free: $0
//   Standard: $9/mo per app
const STATIC_WEB_APP_RATES: Record<string, number> = {
  Free: 0,
  Standard: 9.0,
};

export const staticWebAppCostCalculator: CostCalculator = async (properties) => {
  const tier = (properties.sku_tier as string | undefined) ?? 'Free';
  const rate = STATIC_WEB_APP_RATES[tier] ?? 0;

  return {
    monthly: rate,
    breakdown: [{ label: `Static Web App (${tier})`, cost: rate }],
  };
};

// Azure SignalR Service monthly rates (East US)
//   Free:     $0 (20 connections, 20k msgs/day)
//   Standard: ~$48.97/unit/mo (1000 connections, 1M msgs/day per unit)
//   Premium:  ~$97.94/unit/mo
const SIGNALR_RATES: Record<string, number> = {
  Free: 0,
  Standard: 48.97,
  Premium: 97.94,
};

export const signalrServiceCostCalculator: CostCalculator = async (properties) => {
  const tier = (properties.sku_name as string | undefined) ?? 'Free_F1';
  const capacity = Math.max(1, Number(properties.capacity ?? 1));

  // Parse tier from sku_name like "Free_F1", "Standard_S1", "Premium_P1"
  const skuKey = tier.startsWith('Premium') ? 'Premium'
    : tier.startsWith('Standard') ? 'Standard'
    : 'Free';

  const unitRate = SIGNALR_RATES[skuKey] ?? 0;
  const monthly = unitRate * (skuKey === 'Free' ? 1 : capacity);

  return {
    monthly,
    breakdown: [
      { label: `SignalR ${skuKey}${skuKey !== 'Free' ? ` (${capacity} units)` : ''}`, cost: monthly },
    ],
  };
};
