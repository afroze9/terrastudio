import { fetchMonthlyPrice } from '$lib/services/pricing-service';
import type { CostCalculator } from '../index';

// VM Scale Set: same VM pricing × instance count
export const vmssCostCalculator: CostCalculator = async (properties, region) => {
  const size = (properties.sku as string | undefined) ?? 'Standard_B2s';
  const instanceCount = (properties.instances as number | undefined) ?? 2;

  const unitPrice = await fetchMonthlyPrice('Virtual Machines', size, region);
  if (unitPrice === null) return { monthly: null, breakdown: [] };

  const monthly = unitPrice * instanceCount;
  return {
    monthly,
    breakdown: [
      { label: `VMSS (${size} × ${instanceCount} instances)`, cost: monthly },
    ],
  };
};

// AKS: free control plane (free/standard tier), node pools billed as VMs
// Standard tier: ~$0.10/hr (~$73/mo) for uptime SLA
const AKS_TIER_RATES: Record<string, number> = {
  Free: 0,
  Standard: 73.0,
  Premium: 146.0,
};

export const aksCostCalculator: CostCalculator = async (properties, region) => {
  const tier = (properties.sku_tier as string | undefined) ?? 'Free';
  const vmSize = (properties.default_node_pool_vm_size as string | undefined) ?? 'Standard_DS2_v2';
  const nodeCount = (properties.default_node_pool_node_count as number | undefined) ?? 3;

  const tierCost = AKS_TIER_RATES[tier] ?? 0;
  const vmPrice = await fetchMonthlyPrice('Virtual Machines', vmSize, region);

  const breakdown: { label: string; cost: number }[] = [];
  let monthly = tierCost;

  if (tierCost > 0) {
    breakdown.push({ label: `AKS ${tier} tier`, cost: tierCost });
  } else {
    breakdown.push({ label: 'AKS Free tier (control plane)', cost: 0 });
  }

  if (vmPrice !== null) {
    const nodeCost = vmPrice * nodeCount;
    monthly += nodeCost;
    breakdown.push({ label: `Default pool (${vmSize} × ${nodeCount})`, cost: nodeCost });
  }

  return { monthly: vmPrice !== null ? monthly : null, breakdown };
};

// AKS Node Pool: VM pricing × node count
export const aksNodePoolCostCalculator: CostCalculator = async (properties, region) => {
  const vmSize = (properties.vm_size as string | undefined) ?? 'Standard_DS2_v2';
  const nodeCount = (properties.node_count as number | undefined) ?? 3;

  const vmPrice = await fetchMonthlyPrice('Virtual Machines', vmSize, region);
  if (vmPrice === null) return { monthly: null, breakdown: [] };

  const monthly = vmPrice * nodeCount;
  return {
    monthly,
    breakdown: [
      { label: `Node pool (${vmSize} × ${nodeCount})`, cost: monthly },
    ],
  };
};

// Container App Environment: Consumption = usage-based, Workload Profiles = base + vCPU/memory
const CAE_WORKLOAD_BASE = 90.0; // ~$0.123/hr for dedicated environment

export const containerAppEnvironmentCostCalculator: CostCalculator = async (properties) => {
  const type = (properties.infrastructure_type as string | undefined) ?? 'Consumption';

  if (type === 'Consumption') {
    return { monthly: null, breakdown: [{ label: 'Container App Environment (Consumption, usage-based)', cost: 0 }] };
  }

  return {
    monthly: CAE_WORKLOAD_BASE,
    breakdown: [{ label: `Container App Environment (Workload Profiles base)`, cost: CAE_WORKLOAD_BASE }],
  };
};

// Container App: Consumption pricing
// vCPU: $0.000024/vCPU-s, Memory: $0.000003/GiB-s
// At 100% utilization: 1 vCPU = ~$62/mo, 2 GiB = ~$15.5/mo
const CA_VCPU_RATE_PER_MONTH = 62.21; // 1 vCPU × 86400 × 30 × $0.000024
const CA_MEM_RATE_PER_GB_MONTH = 7.78; // 1 GiB × 86400 × 30 × $0.000003

export const containerAppCostCalculator: CostCalculator = async (properties) => {
  const cpu = (properties.cpu as number | undefined) ?? 0.5;
  const memory = (properties.memory as number | undefined) ?? 1.0;
  const replicas = (properties.min_replicas as number | undefined) ?? 1;

  const cpuCost = Math.round(cpu * CA_VCPU_RATE_PER_MONTH * replicas * 100) / 100;
  const memCost = Math.round(memory * CA_MEM_RATE_PER_GB_MONTH * replicas * 100) / 100;
  const monthly = cpuCost + memCost;

  return {
    monthly,
    breakdown: [
      { label: `vCPU (${cpu} × ${replicas} replicas)`, cost: cpuCost },
      { label: `Memory (${memory} GiB × ${replicas} replicas)`, cost: memCost },
    ],
  };
};

// Container Group (ACI): per-vCPU-second + per-GiB-second
// vCPU: ~$0.0000135/s (~$35/mo), Memory: ~$0.0000015/GiB-s (~$3.9/mo)
const ACI_VCPU_RATE_PER_MONTH = 35.04;
const ACI_MEM_RATE_PER_GB_MONTH = 3.89;

export const containerGroupCostCalculator: CostCalculator = async (properties) => {
  const cpu = (properties.cpu as number | undefined) ?? 1;
  const memoryGb = (properties.memory as number | undefined) ?? 1.5;

  const cpuCost = Math.round(cpu * ACI_VCPU_RATE_PER_MONTH * 100) / 100;
  const memCost = Math.round(memoryGb * ACI_MEM_RATE_PER_GB_MONTH * 100) / 100;
  const monthly = cpuCost + memCost;

  return {
    monthly,
    breakdown: [
      { label: `vCPU (${cpu} cores)`, cost: cpuCost },
      { label: `Memory (${memoryGb} GiB)`, cost: memCost },
    ],
  };
};
