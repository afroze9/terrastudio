import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const containerAppEnvironmentHclGenerator: HclGenerator = {
  typeId: 'azurerm/containers/container_app_environment',
  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const zoneRedundant = props['zone_redundancy_enabled'] as boolean | undefined;
    const internalLb = props['internal_load_balancer_enabled'] as boolean | undefined;

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);
    const nameExpr = context.getPropertyExpression(resource, 'name', name);

    const lines: string[] = [
      `resource "azurerm_container_app_environment" "${resource.terraformName}" {`,
      `  name                = ${nameExpr}`,
      `  resource_group_name = ${rgExpr}`,
      `  location            = ${locExpr}`,
    ];

    const logRef = resource.references['log_analytics_workspace_id'];
    if (logRef) {
      const logIdExpr = context.getAttributeReference(logRef, 'id');
      lines.push(`  log_analytics_workspace_id = ${logIdExpr}`);
    }

    if (zoneRedundant === true || resource.variableOverrides?.['zone_redundancy_enabled'] === 'variable') {
      lines.push(`  zone_redundancy_enabled = ${context.getPropertyExpression(resource, 'zone_redundancy_enabled', zoneRedundant ?? false)}`);
    }

    if (internalLb === true || resource.variableOverrides?.['internal_load_balancer_enabled'] === 'variable') {
      lines.push(`  internal_load_balancer_enabled = ${context.getPropertyExpression(resource, 'internal_load_balancer_enabled', internalLb ?? false)}`);
    }

    lines.push('', '  tags = local.common_tags', '}');

    return [{ blockType: 'resource', terraformType: 'azurerm_container_app_environment', name: resource.terraformName, content: lines.join('\n') }];
  },
};
