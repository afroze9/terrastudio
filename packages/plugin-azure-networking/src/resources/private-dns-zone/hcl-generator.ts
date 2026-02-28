import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';
import { escapeHclString as e } from '@terrastudio/core';

export const privateDnsZoneHclGenerator: HclGenerator = {
  typeId: 'azurerm/networking/private_dns_zone',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;

    const rgExpr = context.getResourceGroupExpression(resource);

    const lines: string[] = [
      `resource "azurerm_private_dns_zone" "${resource.terraformName}" {`,
      `  name                = "${e(name)}"`,
      `  resource_group_name = ${rgExpr}`,
      '',
      '  tags = local.common_tags',
      '}',
    ];

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_private_dns_zone',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
