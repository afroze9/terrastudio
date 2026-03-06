import type { CostCalculator } from '../index';

// EC2 Instance on-demand monthly rates (us-east-1, Linux)
// Price = hourly rate × 730 hours/month
const EC2_RATES: Record<string, number> = {
  't2.micro':   8.47,
  't2.small':   16.94,
  't2.medium':  33.87,
  't3.micro':   7.59,
  't3.small':   15.18,
  't3.medium':  30.37,
  't3.large':   60.74,
  'm5.large':   70.08,
  'm5.xlarge':  140.16,
  'c5.large':   62.05,
  'c5.xlarge':  124.10,
  'r5.large':   91.98,
};

// EBS storage rates ($/GB/month, us-east-1)
const EBS_RATES: Record<string, number> = {
  gp3: 0.08,
  gp2: 0.10,
  io1: 0.125,
  io2: 0.125,
  st1: 0.045,
  sc1: 0.015,
};

export const ec2InstanceCostCalculator: CostCalculator = async (properties) => {
  const instanceType = (properties.instance_type as string | undefined) ?? 't3.micro';
  const volumeSize = Number(properties.root_block_device_size ?? 8);
  const volumeType = (properties.root_block_device_type as string | undefined) ?? 'gp3';

  const computeRate = EC2_RATES[instanceType];
  if (computeRate === undefined) return { monthly: null, breakdown: [] };

  const storageRate = EBS_RATES[volumeType] ?? EBS_RATES['gp3'];
  const storageCost = Math.round(volumeSize * storageRate * 100) / 100;
  const monthly = computeRate + storageCost;

  return {
    monthly,
    breakdown: [
      { label: `EC2 ${instanceType}`, cost: computeRate },
      { label: `EBS ${volumeType} (${volumeSize} GB)`, cost: storageCost },
    ],
  };
};

// RDS Instance on-demand monthly rates (us-east-1, Single-AZ)
// Multi-AZ roughly doubles the compute cost
const RDS_RATES: Record<string, number> = {
  'db.t3.micro':  13.14,
  'db.t3.small':  26.28,
  'db.t3.medium': 52.56,
  'db.t3.large':  105.12,
  'db.m5.large':  124.10,
  'db.m5.xlarge': 248.20,
  'db.r5.large':  175.20,
};

// RDS storage rates ($/GB/month)
const RDS_STORAGE_RATES: Record<string, number> = {
  gp3: 0.08,
  gp2: 0.115,
  io1: 0.125,
  io2: 0.125,
};

export const rdsInstanceCostCalculator: CostCalculator = async (properties) => {
  const instanceClass = (properties.instance_class as string | undefined) ?? 'db.t3.micro';
  const multiAz = properties.multi_az === true || properties.multi_az === 'true';
  const storageGb = Number(properties.allocated_storage ?? 20);
  const storageType = (properties.storage_type as string | undefined) ?? 'gp3';

  const computeRate = RDS_RATES[instanceClass];
  if (computeRate === undefined) return { monthly: null, breakdown: [] };

  const computeCost = multiAz ? computeRate * 2 : computeRate;
  const storageRate = RDS_STORAGE_RATES[storageType] ?? RDS_STORAGE_RATES['gp3'];
  const storageCost = Math.round(storageGb * storageRate * (multiAz ? 2 : 1) * 100) / 100;
  const monthly = computeCost + storageCost;

  return {
    monthly,
    breakdown: [
      { label: `RDS ${instanceClass}${multiAz ? ' (Multi-AZ)' : ''}`, cost: computeCost },
      { label: `Storage ${storageType} (${storageGb} GB)`, cost: storageCost },
    ],
  };
};

// ALB: ~$0.0225/hr base (~$16.43/mo) + ~$0.008/LCU-hr (~$5.84/LCU-mo)
// NLB: ~$0.0225/hr base (~$16.43/mo) + ~$0.006/NLCU-hr (~$4.38/NLCU-mo)
const ALB_BASE = 16.43;
const NLB_BASE = 16.43;
const ALB_LCU_RATE = 5.84;
const NLB_NLCU_RATE = 4.38;

export const albCostCalculator: CostCalculator = async (properties) => {
  const type = (properties.load_balancer_type as string | undefined) ?? 'application';
  const isNlb = type === 'network';

  const base = isNlb ? NLB_BASE : ALB_BASE;
  const lcuRate = isNlb ? NLB_NLCU_RATE : ALB_LCU_RATE;
  // Estimate 1 LCU for a baseline deployment
  const estimatedLcus = 1;
  const lcuCost = Math.round(estimatedLcus * lcuRate * 100) / 100;
  const monthly = base + lcuCost;

  const label = isNlb ? 'NLB' : 'ALB';
  return {
    monthly,
    breakdown: [
      { label: `${label} (base)`, cost: base },
      { label: `${estimatedLcus} LCU estimate`, cost: lcuCost },
    ],
  };
};

// Elastic IP: $3.65/mo (since Feb 2024, all EIPs cost $0.005/hr whether attached or not)
const EIP_MONTHLY = 3.65;

export const eipCostCalculator: CostCalculator = async () => {
  return {
    monthly: EIP_MONTHLY,
    breakdown: [{ label: 'Elastic IP ($0.005/hr)', cost: EIP_MONTHLY }],
  };
};

// NAT Gateway: ~$0.045/hr (~$32.85/mo) + $0.045/GB data processed
const NAT_GW_BASE = 32.85;
const NAT_GW_DATA_RATE = 0.045;
const NAT_GW_DEFAULT_GB = 100;

export const natGatewayCostCalculator: CostCalculator = async (properties) => {
  const connectivityType = (properties.connectivity_type as string | undefined) ?? 'public';

  // Private NAT Gateways have same hourly charge but no data processing charge
  const dataGb = connectivityType === 'private' ? 0
    : (typeof properties._cost_data_gb === 'number' ? properties._cost_data_gb : NAT_GW_DEFAULT_GB);

  const dataCost = Math.round(dataGb * NAT_GW_DATA_RATE * 100) / 100;
  const monthly = NAT_GW_BASE + dataCost;

  return {
    monthly,
    breakdown: [
      { label: 'NAT Gateway (base)', cost: NAT_GW_BASE },
      ...(dataCost > 0 ? [{ label: `Data processed (${dataGb} GB × $${NAT_GW_DATA_RATE}/GB)`, cost: dataCost }] : []),
    ],
  };
};
