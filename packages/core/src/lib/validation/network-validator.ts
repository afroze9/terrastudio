import type { ValidationError } from '@terrastudio/types';
import { cidrsOverlap, cidrContains, isValidCidr } from '../networking/cidr-utils.js';

/**
 * Minimal node shape needed for network topology validation.
 * Avoids coupling to SvelteFlow's full node type.
 */
export interface TopologyNode {
  id: string;
  type: string;
  parentId?: string;
  data: {
    properties: Record<string, unknown>;
    label?: string;
  };
}

export interface TopologyError {
  instanceId: string;
  errors: ValidationError[];
}

/**
 * Validates network topology constraints:
 * 1. Subnet CIDRs must fall within their parent VNet's address space
 * 2. Sibling subnets within the same VNet must not have overlapping CIDRs
 */
export function validateNetworkTopology(
  nodes: TopologyNode[],
): TopologyError[] {
  const results: TopologyError[] = [];

  // Group subnets by their parent VNet
  const subnetsByVnet = new Map<string, TopologyNode[]>();
  for (const node of nodes) {
    if (node.type === 'azurerm/networking/subnet' && node.parentId) {
      const siblings = subnetsByVnet.get(node.parentId) ?? [];
      siblings.push(node);
      subnetsByVnet.set(node.parentId, siblings);
    }
  }

  for (const [vnetId, subnets] of subnetsByVnet) {
    const vnet = nodes.find((n) => n.id === vnetId);
    if (!vnet) continue;

    const vnetAddressSpace = vnet.data.properties?.address_space as string[] | undefined;
    const vnetCidr = vnetAddressSpace?.[0];

    for (const subnet of subnets) {
      const subnetPrefixes = subnet.data.properties?.address_prefixes as string[] | undefined;
      const subnetCidr = subnetPrefixes?.[0];
      if (!subnetCidr || !isValidCidr(subnetCidr)) continue;

      const errors: ValidationError[] = [];

      // Check: subnet CIDR must be within parent VNet address space
      if (vnetCidr && isValidCidr(vnetCidr) && !cidrContains(vnetCidr, subnetCidr)) {
        errors.push({
          propertyKey: 'address_prefixes',
          message: `Subnet CIDR ${subnetCidr} is outside VNet address space ${vnetCidr}`,
          severity: 'error',
        });
      }

      // Check: subnet CIDR must not overlap with sibling subnets
      for (const sibling of subnets) {
        if (sibling.id === subnet.id) continue;
        const siblingPrefixes = sibling.data.properties?.address_prefixes as string[] | undefined;
        const siblingCidr = siblingPrefixes?.[0];
        if (!siblingCidr || !isValidCidr(siblingCidr)) continue;

        if (cidrsOverlap(subnetCidr, siblingCidr)) {
          errors.push({
            propertyKey: 'address_prefixes',
            message: `Subnet CIDR ${subnetCidr} overlaps with sibling subnet ${sibling.data.label ?? sibling.id} (${siblingCidr})`,
            severity: 'warning',
          });
          break; // One overlap warning per subnet is enough
        }
      }

      if (errors.length > 0) {
        results.push({ instanceId: subnet.id, errors });
      }
    }
  }

  return results;
}
