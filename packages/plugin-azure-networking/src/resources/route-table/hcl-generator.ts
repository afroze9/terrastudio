import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const routeTableHclGenerator: HclGenerator = {
  typeId: 'azurerm/networking/route_table',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const bgpPropagation = props['bgp_route_propagation_enabled'] as boolean | undefined;

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);

    const lines: string[] = [
      `resource "azurerm_route_table" "${resource.terraformName}" {`,
      `  name                = "${name}"`,
      `  location            = ${locExpr}`,
      `  resource_group_name = ${rgExpr}`,
    ];

    if (bgpPropagation === false) {
      lines.push('  bgp_route_propagation_enabled = false');
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_route_table',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
