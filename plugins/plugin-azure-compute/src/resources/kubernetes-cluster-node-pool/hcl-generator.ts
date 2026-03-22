import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const kubernetesClusterNodePoolHclGenerator: HclGenerator = {
  typeId: 'azurerm/containers/kubernetes_cluster_node_pool',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const vmSize = (props['vm_size'] as string) ?? 'Standard_B2s';
    const nodeCount = props['node_count'] as number | undefined;
    const autoScaling = props['auto_scaling_enabled'] as boolean | undefined;
    const minCount = props['min_count'] as number | undefined;
    const maxCount = props['max_count'] as number | undefined;
    const osType = props['os_type'] as string | undefined;
    const mode = props['mode'] as string | undefined;
    const nodeLabels = props['node_labels'] as Record<string, string> | undefined;
    const nodeTaints = props['node_taints'] as string[] | undefined;
    const zones = props['zones'] as string[] | undefined;
    const priority = props['priority'] as string | undefined;
    const evictionPolicy = props['eviction_policy'] as string | undefined;
    const spotMaxPrice = props['spot_max_price'] as number | undefined;

    const dependsOn: string[] = [];

    const clusterRef = resource.references['kubernetes_cluster_id'];
    const clusterIdExpr = clusterRef
      ? context.getAttributeReference(clusterRef, 'id')
      : '"<cluster-id>"';

    if (clusterRef) {
      const addr = context.getTerraformAddress(clusterRef);
      if (addr) dependsOn.push(addr);
    }

    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const vmSizeExpr = context.getPropertyExpression(resource, 'vm_size', vmSize);

    const lines: string[] = [
      `resource "azurerm_kubernetes_cluster_node_pool" "${resource.terraformName}" {`,
      `  name                  = ${nameExpr}`,
      `  kubernetes_cluster_id = ${clusterIdExpr}`,
      `  vm_size               = ${vmSizeExpr}`,
    ];

    if (autoScaling) {
      lines.push(`  auto_scaling_enabled  = ${context.getPropertyExpression(resource, 'auto_scaling_enabled', autoScaling)}`);
      if (minCount !== undefined) {
        lines.push(`  min_count             = ${context.getPropertyExpression(resource, 'min_count', minCount)}`);
      }
      if (maxCount !== undefined) {
        lines.push(`  max_count             = ${context.getPropertyExpression(resource, 'max_count', maxCount)}`);
      }
    } else {
      const count = nodeCount ?? 1;
      lines.push(`  node_count            = ${context.getPropertyExpression(resource, 'node_count', count)}`);
    }

    if (osType && osType !== 'Linux') {
      lines.push(`  os_type               = ${context.getPropertyExpression(resource, 'os_type', osType)}`);
    }

    if (mode && mode !== 'User') {
      lines.push(`  mode                  = ${context.getPropertyExpression(resource, 'mode', mode)}`);
    }

    // Node labels
    if (nodeLabels && Object.keys(nodeLabels).length > 0) {
      lines.push(`  node_labels = {`);
      for (const [k, v] of Object.entries(nodeLabels)) {
        lines.push(`    "${k}" = "${v}"`);
      }
      lines.push(`  }`);
    }

    // Node taints
    if (nodeTaints && nodeTaints.length > 0) {
      lines.push(`  node_taints           = ${context.getPropertyExpression(resource, 'node_taints', nodeTaints)}`);
    }

    // Availability zones
    if (zones && zones.length > 0) {
      lines.push(`  zones                 = ${context.getPropertyExpression(resource, 'zones', zones)}`);
    }

    // Spot configuration
    if (priority === 'Spot') {
      lines.push(`  priority              = ${context.getPropertyExpression(resource, 'priority', priority)}`);
      if (evictionPolicy) {
        lines.push(`  eviction_policy       = ${context.getPropertyExpression(resource, 'eviction_policy', evictionPolicy)}`);
      }
      if (spotMaxPrice !== undefined) {
        lines.push(`  spot_max_price        = ${context.getPropertyExpression(resource, 'spot_max_price', spotMaxPrice)}`);
      }
    }

    // Subnet reference for Azure CNI
    const subnetRef = resource.references['vnet_subnet_id'];
    if (subnetRef) {
      const subnetIdExpr = context.getAttributeReference(subnetRef, 'id');
      lines.push(`  vnet_subnet_id        = ${subnetIdExpr}`);
    }

    lines.push('', '  tags = local.common_tags', '}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_kubernetes_cluster_node_pool',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
