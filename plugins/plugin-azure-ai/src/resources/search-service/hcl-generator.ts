import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const searchServiceHclGenerator: HclGenerator = {
  typeId: 'azurerm/ai/search_service',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const sku = (props['sku'] as string) ?? 'standard';
    const replicaCount = props['replica_count'] as number | undefined;
    const partitionCount = props['partition_count'] as number | undefined;
    const publicNetworkAccessEnabled = props['public_network_access_enabled'] as boolean | undefined;
    const hostingMode = props['hosting_mode'] as string | undefined;

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);

    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const skuExpr = context.getPropertyExpression(resource, 'sku', sku);

    const lines: string[] = [
      `resource "azurerm_search_service" "${resource.terraformName}" {`,
      `  name                = ${nameExpr}`,
      `  resource_group_name = ${rgExpr}`,
      `  location            = ${locExpr}`,
      `  sku                 = ${skuExpr}`,
    ];

    if ((replicaCount !== undefined && replicaCount !== 1) || resource.variableOverrides?.['replica_count'] === 'variable') {
      const expr = context.getPropertyExpression(resource, 'replica_count', replicaCount ?? 1);
      lines.push(`  replica_count       = ${expr}`);
    }

    if ((partitionCount !== undefined && partitionCount !== 1) || resource.variableOverrides?.['partition_count'] === 'variable') {
      const expr = context.getPropertyExpression(resource, 'partition_count', partitionCount ?? 1);
      lines.push(`  partition_count     = ${expr}`);
    }

    if (publicNetworkAccessEnabled === false || resource.variableOverrides?.['public_network_access_enabled'] === 'variable') {
      const expr = context.getPropertyExpression(resource, 'public_network_access_enabled', publicNetworkAccessEnabled ?? true);
      lines.push(`  public_network_access_enabled = ${expr}`);
    }

    if ((hostingMode !== undefined && hostingMode !== 'default') || resource.variableOverrides?.['hosting_mode'] === 'variable') {
      const expr = context.getPropertyExpression(resource, 'hosting_mode', hostingMode ?? 'default');
      lines.push(`  hosting_mode        = ${expr}`);
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_search_service',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
