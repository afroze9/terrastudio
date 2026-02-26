import type { CostCalculator } from '../index';

// Storage pricing: approximate per GB/month rates for LRS in East US
// Source: Azure Blob Storage pricing page
const STORAGE_RATES: Record<string, number> = {
  'Standard_LRS': 0.0184,
  'Standard_GRS': 0.0368,
  'Standard_RAGRS': 0.046,
  'Standard_ZRS': 0.023,
  'Premium_LRS': 0.15,
};

// Base cost per storage account per month (operations + base overhead ≈ $3-5)
const BASE_MONTHLY = 3.0;
// Default assumed GB if user hasn't set a usage input
const DEFAULT_GB = 100;

export const storageAccountCostCalculator: CostCalculator = async (properties) => {
  const tier = (properties.account_tier as string | undefined) ?? 'Standard';
  const replication = (properties.account_replication_type as string | undefined) ?? 'LRS';
  const key = `${tier}_${replication}`;

  const ratePerGb = STORAGE_RATES[key];
  if (ratePerGb === undefined) return { monthly: null, breakdown: [] };

  const storageGb = typeof properties._cost_storage_gb === 'number'
    ? properties._cost_storage_gb
    : DEFAULT_GB;

  const storageCost = storageGb * ratePerGb;
  const monthly = BASE_MONTHLY + storageCost;

  return {
    monthly,
    breakdown: [
      { label: `Storage (${storageGb} GB ${tier} ${replication})`, cost: storageCost },
      { label: 'Base (operations estimate)', cost: BASE_MONTHLY },
    ],
  };
};
