import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const appServicePlanHclGenerator: HclGenerator = {
  typeId: 'azurerm/compute/app_service_plan',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const osType = (props['os_type'] as string) ?? 'Linux';
    const skuName = (props['sku_name'] as string) ?? 'B1';
    const workerCount = props['worker_count'] as number | undefined;
    const zoneBalancing = props['zone_balancing_enabled'] as boolean | undefined;

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);

    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const osTypeExpr = context.getPropertyExpression(resource, 'os_type', osType);
    const skuNameExpr = context.getPropertyExpression(resource, 'sku_name', skuName);

    const lines: string[] = [
      `resource "azurerm_service_plan" "${resource.terraformName}" {`,
      `  name                = ${nameExpr}`,
      `  resource_group_name = ${rgExpr}`,
      `  location            = ${locExpr}`,
      `  os_type             = ${osTypeExpr}`,
      `  sku_name            = ${skuNameExpr}`,
    ];

    if (workerCount !== undefined && workerCount !== 1) {
      lines.push(`  worker_count        = ${context.getPropertyExpression(resource, 'worker_count', workerCount)}`);
    }
    if (zoneBalancing) {
      lines.push(`  zone_balancing_enabled = ${context.getPropertyExpression(resource, 'zone_balancing_enabled', zoneBalancing)}`);
    }

    lines.push('', '  tags = local.common_tags', '}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_service_plan',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
