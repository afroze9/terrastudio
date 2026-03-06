import type { CostCalculator } from '../index';

// Secrets Manager: $0.40/secret/month + $0.05 per 10K API calls
const SECRETS_RATE = 0.40;

export const secretsManagerCostCalculator: CostCalculator = async (properties) => {
  const secrets = typeof properties._cost_secrets === 'number' ? properties._cost_secrets : 1;
  const monthly = Math.round(secrets * SECRETS_RATE * 100) / 100;

  return {
    monthly,
    breakdown: [
      { label: `${secrets} secret(s) × $${SECRETS_RATE}/mo`, cost: monthly },
    ],
  };
};

// ECR: $0.10/GB/month for private repos
const ECR_RATE = 0.10;

export const ecrCostCalculator: CostCalculator = async (properties) => {
  const storageGb = typeof properties._cost_storage_gb === 'number' ? properties._cost_storage_gb : 5;
  const monthly = Math.round(storageGb * ECR_RATE * 100) / 100;

  return {
    monthly,
    breakdown: [
      { label: `Storage (${storageGb} GB × $${ECR_RATE}/GB)`, cost: monthly },
    ],
  };
};

// EFS: $0.30/GB/month (Standard), $0.025/GB/month (IA)
const EFS_STANDARD_RATE = 0.30;

export const efsCostCalculator: CostCalculator = async (properties) => {
  const storageGb = typeof properties._cost_storage_gb === 'number' ? properties._cost_storage_gb : 50;
  const monthly = Math.round(storageGb * EFS_STANDARD_RATE * 100) / 100;

  return {
    monthly,
    breakdown: [
      { label: `EFS Standard (${storageGb} GB × $${EFS_STANDARD_RATE}/GB)`, cost: monthly },
    ],
  };
};

// ElastiCache on-demand monthly rates (us-east-1)
const ELASTICACHE_RATES: Record<string, number> = {
  'cache.t3.micro':   12.41,
  'cache.t3.small':   24.82,
  'cache.t3.medium':  49.64,
  'cache.m6g.large':  109.50,
  'cache.m6g.xlarge': 219.00,
  'cache.r6g.large':  131.40,
  'cache.r6g.xlarge': 262.80,
};

export const elasticacheCostCalculator: CostCalculator = async (properties) => {
  const nodeType = (properties.node_type as string | undefined) ?? 'cache.t3.micro';
  const numNodes = Number(properties.num_cache_nodes ?? 1);

  const rate = ELASTICACHE_RATES[nodeType];
  if (rate === undefined) return { monthly: null, breakdown: [] };

  const monthly = Math.round(rate * numNodes * 100) / 100;

  return {
    monthly,
    breakdown: [
      { label: `${numNodes}× ${nodeType}`, cost: monthly },
    ],
  };
};

// EKS Node Group: EC2 instance pricing × node count
const EKS_NODE_RATES: Record<string, number> = {
  't3.small':   15.18,
  't3.medium':  30.37,
  't3.large':   60.74,
  't3.xlarge':  121.47,
  'm5.large':   70.08,
  'm5.xlarge':  140.16,
  'c5.large':   62.05,
  'c5.xlarge':  124.10,
  'r5.large':   91.98,
  'r5.xlarge':  183.96,
};

export const eksNodeGroupCostCalculator: CostCalculator = async (properties) => {
  const instanceType = (properties.instance_types as string | undefined) ?? 't3.medium';
  const desiredSize = Number(properties.desired_size ?? 2);

  const rate = EKS_NODE_RATES[instanceType];
  if (rate === undefined) return { monthly: null, breakdown: [] };

  const monthly = Math.round(rate * desiredSize * 100) / 100;

  return {
    monthly,
    breakdown: [
      { label: `${desiredSize}× ${instanceType}`, cost: monthly },
    ],
  };
};

// EKS: $73/month flat for control plane
const EKS_MONTHLY = 73;

export const eksCostCalculator: CostCalculator = async () => {
  return {
    monthly: EKS_MONTHLY,
    breakdown: [
      { label: 'EKS control plane ($0.10/hr)', cost: EKS_MONTHLY },
    ],
  };
};

// ECS Fargate: $0.04048/vCPU/hr + $0.004445/GB/hr
const FARGATE_VCPU_RATE = 0.04048;
const FARGATE_MEM_RATE = 0.004445;

export const ecsCostCalculator: CostCalculator = async (properties) => {
  const vcpuHours = typeof properties._cost_vcpu_hours === 'number' ? properties._cost_vcpu_hours : 730;
  const memGbHours = typeof properties._cost_memory_gb_hours === 'number' ? properties._cost_memory_gb_hours : 1460;

  const vcpuCost = Math.round(vcpuHours * FARGATE_VCPU_RATE * 100) / 100;
  const memCost = Math.round(memGbHours * FARGATE_MEM_RATE * 100) / 100;
  const monthly = vcpuCost + memCost;

  return {
    monthly,
    breakdown: [
      { label: `vCPU (${vcpuHours} hrs × $${FARGATE_VCPU_RATE})`, cost: vcpuCost },
      { label: `Memory (${memGbHours} GB-hrs × $${FARGATE_MEM_RATE})`, cost: memCost },
    ],
  };
};
