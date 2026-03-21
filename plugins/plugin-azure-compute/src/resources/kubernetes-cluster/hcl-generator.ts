import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const kubernetesClusterHclGenerator: HclGenerator = {
  typeId: 'azurerm/containers/kubernetes_cluster',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const dnsPrefix = props['dns_prefix'] as string;
    const kubernetesVersion = props['kubernetes_version'] as string | undefined;
    const skuTier = props['sku_tier'] as string | undefined;
    const networkPlugin = (props['network_plugin'] as string) ?? 'azure';
    const identityType = (props['identity_type'] as string) ?? 'SystemAssigned';
    const loadBalancerSku = (props['load_balancer_sku'] as string) ?? 'standard';
    const outboundType = (props['outbound_type'] as string) ?? 'loadBalancer';

    // Security
    const privateClusterEnabled = props['private_cluster_enabled'] as boolean | undefined;
    const rbacEnabled = props['rbac_enabled'] as boolean | undefined;
    const apiServerAuthorizedIpRanges = props['api_server_authorized_ip_ranges'] as string[] | undefined;

    // Addons
    const azurePolicyEnabled = props['azure_policy_enabled'] as boolean | undefined;
    const httpApplicationRoutingEnabled = props['http_application_routing_enabled'] as boolean | undefined;
    const workloadIdentityEnabled = props['workload_identity_enabled'] as boolean | undefined;
    const oidcIssuerEnabled = props['oidc_issuer_enabled'] as boolean | undefined;

    // Monitoring
    const omsAgentEnabled = props['oms_agent_enabled'] as boolean | undefined;
    const logAnalyticsWorkspaceId = props['log_analytics_workspace_id'] as string | undefined;

    // Default node pool
    const poolName = (props['default_pool_name'] as string) ?? 'default';
    const poolVmSize = (props['default_pool_vm_size'] as string) ?? 'Standard_B2s';
    const poolCount = props['default_pool_count'] as number | undefined;
    const poolAutoScaling = props['default_pool_auto_scaling'] as boolean | undefined;
    const poolMinCount = props['default_pool_min_count'] as number | undefined;
    const poolMaxCount = props['default_pool_max_count'] as number | undefined;

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);
    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const dnsPrefixExpr = context.getPropertyExpression(resource, 'dns_prefix', dnsPrefix);

    const lines: string[] = [
      `resource "azurerm_kubernetes_cluster" "${resource.terraformName}" {`,
      `  name                = ${nameExpr}`,
      `  resource_group_name = ${rgExpr}`,
      `  location            = ${locExpr}`,
      `  dns_prefix          = ${dnsPrefixExpr}`,
    ];

    if (kubernetesVersion) {
      lines.push(`  kubernetes_version  = ${context.getPropertyExpression(resource, 'kubernetes_version', kubernetesVersion)}`);
    }

    if (skuTier && skuTier !== 'Free') {
      lines.push(`  sku_tier            = ${context.getPropertyExpression(resource, 'sku_tier', skuTier)}`);
    }

    // Security
    if (privateClusterEnabled || resource.variableOverrides?.['private_cluster_enabled'] === 'variable') {
      lines.push(`  private_cluster_enabled = ${context.getPropertyExpression(resource, 'private_cluster_enabled', privateClusterEnabled ?? false)}`);
    }

    // rbac_enabled defaults to true, so always emit it
    const rbacValue = rbacEnabled ?? true;
    lines.push(`  role_based_access_control_enabled = ${context.getPropertyExpression(resource, 'rbac_enabled', rbacValue)}`);

    if ((apiServerAuthorizedIpRanges && apiServerAuthorizedIpRanges.length > 0) || resource.variableOverrides?.['api_server_authorized_ip_ranges'] === 'variable') {
      lines.push('');
      lines.push('  api_server_access_profile {');
      lines.push(`    authorized_ip_ranges = ${context.getPropertyExpression(resource, 'api_server_authorized_ip_ranges', apiServerAuthorizedIpRanges ?? [])}`);
      lines.push('  }');
    }

    // Addons
    if (azurePolicyEnabled || resource.variableOverrides?.['azure_policy_enabled'] === 'variable') {
      lines.push(`  azure_policy_enabled = ${context.getPropertyExpression(resource, 'azure_policy_enabled', azurePolicyEnabled ?? false)}`);
    }
    if (httpApplicationRoutingEnabled || resource.variableOverrides?.['http_application_routing_enabled'] === 'variable') {
      lines.push(`  http_application_routing_enabled = ${context.getPropertyExpression(resource, 'http_application_routing_enabled', httpApplicationRoutingEnabled ?? false)}`);
    }
    if (workloadIdentityEnabled || resource.variableOverrides?.['workload_identity_enabled'] === 'variable') {
      lines.push(`  workload_identity_enabled = ${context.getPropertyExpression(resource, 'workload_identity_enabled', workloadIdentityEnabled ?? false)}`);
    }
    if (oidcIssuerEnabled || resource.variableOverrides?.['oidc_issuer_enabled'] === 'variable') {
      lines.push(`  oidc_issuer_enabled = ${context.getPropertyExpression(resource, 'oidc_issuer_enabled', oidcIssuerEnabled ?? false)}`);
    }

    // Monitoring - OMS Agent
    if (omsAgentEnabled || resource.variableOverrides?.['oms_agent_enabled'] === 'variable') {
      lines.push('');
      lines.push('  oms_agent {');
      lines.push(`    log_analytics_workspace_id = ${context.getPropertyExpression(resource, 'log_analytics_workspace_id', logAnalyticsWorkspaceId ?? '')}`);
      lines.push('  }');
    }

    // Default node pool block
    lines.push('');
    lines.push('  default_node_pool {');
    lines.push(`    name       = ${context.getPropertyExpression(resource, 'default_pool_name', poolName)}`);
    lines.push(`    vm_size    = ${context.getPropertyExpression(resource, 'default_pool_vm_size', poolVmSize)}`);

    if (poolAutoScaling) {
      lines.push(`    auto_scaling_enabled = ${context.getPropertyExpression(resource, 'default_pool_auto_scaling', poolAutoScaling)}`);
      if (poolMinCount !== undefined) {
        lines.push(`    min_count            = ${context.getPropertyExpression(resource, 'default_pool_min_count', poolMinCount)}`);
      }
      if (poolMaxCount !== undefined) {
        lines.push(`    max_count            = ${context.getPropertyExpression(resource, 'default_pool_max_count', poolMaxCount)}`);
      }
    } else {
      const count = poolCount ?? 1;
      lines.push(`    node_count = ${context.getPropertyExpression(resource, 'default_pool_count', count)}`);
    }

    // If the cluster has a subnet reference (Azure CNI), pass it to the default node pool
    const subnetRef = resource.references['vnet_subnet_id'];
    if (networkPlugin === 'azure' && subnetRef) {
      const subnetIdExpr = context.getAttributeReference(subnetRef, 'id');
      lines.push(`    vnet_subnet_id = ${subnetIdExpr}`);
    }

    lines.push('  }');

    // Identity block
    lines.push('');
    lines.push('  identity {');
    lines.push(`    type = ${context.getPropertyExpression(resource, 'identity_type', identityType)}`);
    lines.push('  }');

    // Network profile block
    lines.push('');
    lines.push('  network_profile {');
    lines.push(`    network_plugin    = ${context.getPropertyExpression(resource, 'network_plugin', networkPlugin)}`);
    lines.push(`    load_balancer_sku = ${context.getPropertyExpression(resource, 'load_balancer_sku', loadBalancerSku)}`);
    lines.push(`    outbound_type     = ${context.getPropertyExpression(resource, 'outbound_type', outboundType)}`);
    lines.push('  }');

    lines.push('', '  tags = local.common_tags', '}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_kubernetes_cluster',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
