import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const frontdoorProfileHclGenerator: HclGenerator = {
  typeId: 'azurerm/web/frontdoor_profile',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const skuName = (props['sku_name'] as string) ?? 'Standard_AzureFrontDoor';
    const responseTimeout = props['response_timeout_seconds'] !== undefined
      ? Number(props['response_timeout_seconds'])
      : undefined;

    const rgExpr = context.getResourceGroupExpression(resource);

    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const skuNameExpr = context.getPropertyExpression(resource, 'sku_name', skuName);

    const lines: string[] = [
      `resource "azurerm_cdn_frontdoor_profile" "${resource.terraformName}" {`,
      `  name                = ${nameExpr}`,
      `  resource_group_name = ${rgExpr}`,
      `  sku_name            = ${skuNameExpr}`,
    ];

    if ((responseTimeout !== undefined && responseTimeout !== 120) || resource.variableOverrides?.['response_timeout_seconds'] === 'variable') {
      lines.push(`  response_timeout_seconds = ${context.getPropertyExpression(resource, 'response_timeout_seconds', responseTimeout ?? 120)}`);
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_cdn_frontdoor_profile',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
