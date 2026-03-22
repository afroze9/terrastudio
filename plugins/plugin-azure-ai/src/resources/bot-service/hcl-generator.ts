import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const botServiceHclGenerator: HclGenerator = {
  typeId: 'azurerm/ai/bot_service',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const sku = (props['sku'] as string) ?? 'F0';
    const microsoftAppId = props['microsoft_app_id'] as string;
    const microsoftAppType = props['microsoft_app_type'] as string | undefined;
    const endpoint = props['endpoint'] as string | undefined;

    const rgExpr = context.getResourceGroupExpression(resource);

    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const skuExpr = context.getPropertyExpression(resource, 'sku', sku);
    const appIdExpr = context.getPropertyExpression(resource, 'microsoft_app_id', microsoftAppId);

    const lines: string[] = [
      `resource "azurerm_bot_service_azure_bot" "${resource.terraformName}" {`,
      `  name                = ${nameExpr}`,
      `  resource_group_name = ${rgExpr}`,
      `  location            = "global"`,
      `  sku                 = ${skuExpr}`,
      `  microsoft_app_id    = ${appIdExpr}`,
    ];

    if ((microsoftAppType !== undefined && microsoftAppType !== 'MultiTenant') || resource.variableOverrides?.['microsoft_app_type'] === 'variable') {
      const expr = context.getPropertyExpression(resource, 'microsoft_app_type', microsoftAppType ?? 'MultiTenant');
      lines.push(`  microsoft_app_type  = ${expr}`);
    }

    if ((endpoint !== undefined && endpoint !== '') || resource.variableOverrides?.['endpoint'] === 'variable') {
      const expr = context.getPropertyExpression(resource, 'endpoint', endpoint ?? '');
      lines.push(`  endpoint            = ${expr}`);
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_bot_service_azure_bot',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
