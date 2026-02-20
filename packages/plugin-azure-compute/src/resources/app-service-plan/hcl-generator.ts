import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const appServicePlanHclGenerator: HclGenerator = {
  typeId: 'azurerm/compute/app_service_plan',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const osType = (props['os_type'] as string) ?? 'Linux';
    const skuName = (props['sku_name'] as string) ?? 'B1';

    const rgExpr = context.getResourceGroupExpression();
    const locExpr = context.getLocationExpression();

    const lines: string[] = [
      `resource "azurerm_service_plan" "${resource.terraformName}" {`,
      `  name                = "${name}"`,
      `  resource_group_name = ${rgExpr}`,
      `  location            = ${locExpr}`,
      `  os_type             = "${osType}"`,
      `  sku_name            = "${skuName}"`,
      '',
      '  tags = local.common_tags',
      '}',
    ];

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
