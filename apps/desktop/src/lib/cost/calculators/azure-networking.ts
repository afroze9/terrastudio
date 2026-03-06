import type { CostCalculator } from '../index';

// Azure Load Balancer monthly rates (East US):
//   Basic:    Free
//   Standard: ~$0.025/hr base (~$18.25/mo) + $0.005/rule/hr + $0.005/GB data
const LB_BASE_RATES: Record<string, number> = {
  Basic: 0,
  Standard: 18.25,
};
const LB_RULE_RATE_PER_HR = 0.005;
const LB_DATA_RATE_PER_GB = 0.005;

export const loadBalancerCostCalculator: CostCalculator = async (properties) => {
  const sku = (properties.sku as string | undefined) ?? 'Standard';

  if (sku === 'Basic') {
    return { monthly: 0, breakdown: [{ label: 'Load Balancer (Basic, free)', cost: 0 }] };
  }

  const baseCost = LB_BASE_RATES[sku] ?? LB_BASE_RATES['Standard'];
  const ruleCount = typeof properties._cost_rules === 'number' ? properties._cost_rules : 5;
  const dataGb = typeof properties._cost_data_gb === 'number' ? properties._cost_data_gb : 100;

  const ruleCost = Math.round(ruleCount * LB_RULE_RATE_PER_HR * 730 * 100) / 100;
  const dataCost = Math.round(dataGb * LB_DATA_RATE_PER_GB * 100) / 100;
  const monthly = baseCost + ruleCost + dataCost;

  return {
    monthly,
    breakdown: [
      { label: `Load Balancer Standard (base)`, cost: baseCost },
      { label: `Rules (${ruleCount} × $${LB_RULE_RATE_PER_HR}/hr)`, cost: ruleCost },
      { label: `Data processed (${dataGb} GB × $${LB_DATA_RATE_PER_GB}/GB)`, cost: dataCost },
    ],
  };
};

// Azure DNS Zone: ~$0.50/zone/month for first 25 zones, $0.10/million queries
const DNS_ZONE_BASE = 0.50;
const DNS_QUERY_RATE_PER_MILLION = 0.40;

export const dnsZoneCostCalculator: CostCalculator = async (properties) => {
  const queryMillions = typeof properties._cost_query_millions === 'number'
    ? properties._cost_query_millions
    : 1;

  const queryCost = Math.round(queryMillions * DNS_QUERY_RATE_PER_MILLION * 100) / 100;
  const monthly = DNS_ZONE_BASE + queryCost;

  return {
    monthly,
    breakdown: [
      { label: 'DNS Zone (base)', cost: DNS_ZONE_BASE },
      ...(queryCost > 0 ? [{ label: `Queries (${queryMillions}M × $${DNS_QUERY_RATE_PER_MILLION}/M)`, cost: queryCost }] : []),
    ],
  };
};
