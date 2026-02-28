import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';
import { escapeHclString as e } from '@terrastudio/core';

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

    const lines: string[] = [
      `resource "azurerm_service_plan" "${resource.terraformName}" {`,
      `  name                = "${e(name)}"`,
      `  resource_group_name = ${rgExpr}`,
      `  location            = ${locExpr}`,
      `  os_type             = "${e(osType)}"`,
      `  sku_name            = "${e(skuName)}"`,
    ];

    if (workerCount !== undefined && workerCount !== 1) {
      lines.push(`  worker_count        = ${workerCount}`);
    }
    if (zoneBalancing) {
      lines.push(`  zone_balancing_enabled = true`);
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
