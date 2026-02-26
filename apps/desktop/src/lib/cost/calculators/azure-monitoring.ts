import type { CostCalculator } from '../index';

// Log Analytics: PerGB2018 — $2.76/GB ingested (East US).
const LOG_ANALYTICS_RATE_PER_GB = 2.76;
const LOG_ANALYTICS_DEFAULT_GB_DAY = 5;

export const logAnalyticsCostCalculator: CostCalculator = async (properties) => {
  const gbPerDay = typeof properties._cost_ingestion_gb_day === 'number'
    ? properties._cost_ingestion_gb_day
    : LOG_ANALYTICS_DEFAULT_GB_DAY;

  const monthly = Math.round(gbPerDay * 30 * LOG_ANALYTICS_RATE_PER_GB * 100) / 100;
  return {
    monthly,
    breakdown: [{ label: `Log Analytics (${gbPerDay} GB/day × 30 × $${LOG_ANALYTICS_RATE_PER_GB}/GB)`, cost: monthly }],
  };
};

// Application Insights: first 5 GB/month free, then ~$2.76/GB
const APP_INSIGHTS_RATE_PER_GB = 2.76;
const APP_INSIGHTS_FREE_GB = 5;
const APP_INSIGHTS_DEFAULT_GB_MO = 5;

export const applicationInsightsCostCalculator: CostCalculator = async (properties) => {
  const gbPerMonth = typeof properties._cost_ingestion_gb_mo === 'number'
    ? properties._cost_ingestion_gb_mo
    : APP_INSIGHTS_DEFAULT_GB_MO;

  const billableGb = Math.max(0, gbPerMonth - APP_INSIGHTS_FREE_GB);
  const monthly = Math.round(billableGb * APP_INSIGHTS_RATE_PER_GB * 100) / 100;
  return {
    monthly,
    breakdown: [
      { label: `Data ingestion (${gbPerMonth} GB, ${APP_INSIGHTS_FREE_GB} GB free @ $${APP_INSIGHTS_RATE_PER_GB}/GB)`, cost: monthly },
    ],
  };
};

// Service Bus Namespace approximate monthly rates by tier
const SERVICEBUS_RATES: Record<string, number> = {
  Basic: 9.81,
  Standard: 9.81,  // Standard has per-op pricing on top — base only
  Premium: 677.0,  // Per messaging unit
};
// Standard extra operations: $0.80 per million beyond first 10M (included in base)
const STANDARD_EXTRA_OP_RATE = 0.80;
const STANDARD_INCLUDED_MILLIONS = 10;

export const serviceBusNamespaceCostCalculator: CostCalculator = async (properties) => {
  const sku = (properties.sku as string | undefined) ?? 'Standard';
  const capacity = Math.max(1, Number(properties.capacity ?? 1));
  const rate = SERVICEBUS_RATES[sku] ?? SERVICEBUS_RATES['Standard'];
  const baseCost = sku === 'Premium' ? rate * capacity : rate;

  if (sku === 'Standard') {
    const opMillions = typeof properties._cost_operations_millions === 'number'
      ? properties._cost_operations_millions
      : STANDARD_INCLUDED_MILLIONS;
    const extraMillions = Math.max(0, opMillions - STANDARD_INCLUDED_MILLIONS);
    const opsCost = extraMillions * STANDARD_EXTRA_OP_RATE;
    const monthly = baseCost + opsCost;
    return {
      monthly,
      breakdown: [
        { label: `Service Bus Standard (base, ${STANDARD_INCLUDED_MILLIONS}M ops incl.)`, cost: baseCost },
        ...(opsCost > 0 ? [{ label: `Extra ops (${extraMillions}M × $${STANDARD_EXTRA_OP_RATE})`, cost: opsCost }] : []),
      ],
    };
  }

  return {
    monthly: baseCost,
    breakdown: [{ label: `Service Bus (${sku}${sku === 'Premium' ? ` × ${capacity} MU` : ''})`, cost: baseCost }],
  };
};

// Azure Bastion hourly rates (East US, pay-as-you-go):
//   Developer: Free
//   Basic: ~$0.19/hr × 730 = ~$138.70/mo (fixed 2 instances in base)
//   Standard: ~$0.19/hr × 730 = ~$138.70/mo base (2 instances) + scale units
// Data transfer: first 5 GB free, then ~$0.087/GB
const BASTION_SKU_BASE: Record<string, number> = {
  Developer: 0,
  Basic: 138.70,
  Standard: 138.70,
};
const BASTION_SCALE_UNIT_RATE = 69.35; // ~$0.095/hr extra per scale unit beyond 2
const BASTION_DATA_RATE = 0.087;
const BASTION_FREE_DATA_GB = 5;

export const bastionCostCalculator: CostCalculator = async (properties) => {
  const sku = (properties.sku as string | undefined) ?? 'Basic';
  const scaleUnits = (properties.scale_units as number | undefined) ?? 2;
  const outboundGb = typeof properties._cost_outbound_gb === 'number'
    ? properties._cost_outbound_gb
    : 10;

  const baseCost = BASTION_SKU_BASE[sku] ?? BASTION_SKU_BASE['Basic'];
  // Standard SKU: extra scale units beyond 2 add cost
  const extraUnits = sku === 'Standard' ? Math.max(0, scaleUnits - 2) : 0;
  const scaleUnitCost = extraUnits * BASTION_SCALE_UNIT_RATE;
  const billableGb = Math.max(0, outboundGb - BASTION_FREE_DATA_GB);
  const dataCost = Math.round(billableGb * BASTION_DATA_RATE * 100) / 100;
  const monthly = baseCost + scaleUnitCost + dataCost;

  return {
    monthly,
    breakdown: [
      ...(baseCost > 0 ? [{ label: `Bastion ${sku} (base)`, cost: baseCost }] : [{ label: 'Bastion Developer (free)', cost: 0 }]),
      ...(scaleUnitCost > 0 ? [{ label: `Extra scale units (${extraUnits} × $${BASTION_SCALE_UNIT_RATE})`, cost: scaleUnitCost }] : []),
      ...(dataCost > 0 ? [{ label: `Outbound data (${billableGb} GB × $${BASTION_DATA_RATE}/GB)`, cost: dataCost }] : []),
    ],
  };
};

// Public IP — Static Standard ~$3.65/mo, Basic Static ~$2.19/mo, Dynamic free
export const publicIpCostCalculator: CostCalculator = async (properties) => {
  const allocationMethod = (properties.allocation_method as string | undefined) ?? 'Static';
  const sku = (properties.sku as string | undefined) ?? 'Standard';
  if (allocationMethod === 'Dynamic') return { monthly: 0, breakdown: [{ label: 'Public IP (Dynamic, idle free)', cost: 0 }] };
  const monthly = sku === 'Standard' ? 3.65 : 2.19;
  return {
    monthly,
    breakdown: [{ label: `Public IP (${sku} Static)`, cost: monthly }],
  };
};

// NAT Gateway: ~$0.044/hr base (~$32/mo) + $0.045/GB processed data
const NAT_GATEWAY_BASE = 32.0;
const NAT_GATEWAY_DATA_RATE = 0.045;

export const natGatewayCostCalculator: CostCalculator = async (properties) => {
  const dataGb = typeof properties._cost_data_gb === 'number'
    ? properties._cost_data_gb
    : 100;

  const dataCost = Math.round(dataGb * NAT_GATEWAY_DATA_RATE * 100) / 100;
  const monthly = NAT_GATEWAY_BASE + dataCost;
  return {
    monthly,
    breakdown: [
      { label: 'NAT Gateway (base ~$0.044/hr)', cost: NAT_GATEWAY_BASE },
      { label: `Data processed (${dataGb} GB × $${NAT_GATEWAY_DATA_RATE}/GB)`, cost: dataCost },
    ],
  };
};

// Function App — Consumption plan: usage-based (can't estimate)
// Premium plan: billed via App Service Plan, so the app itself is $0
export const functionAppCostCalculator: CostCalculator = async () => {
  return { monthly: null, breakdown: [] };
};
