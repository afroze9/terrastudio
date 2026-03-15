import type {
  HclGenerator,
  HclBlock,
  ResourceInstance,
  HclGenerationContext,
} from '@terrastudio/types';

export const dnsZoneHclGenerator: HclGenerator = {
  typeId: 'azurerm/dns/dns_zone',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;

    const rgExpr = context.getResourceGroupExpression(resource);
    const nameExpr = context.getPropertyExpression(resource, 'name', name);

    const lines: string[] = [
      `resource "azurerm_dns_zone" "${resource.terraformName}" {`,
      `  name                = ${nameExpr}`,
      `  resource_group_name = ${rgExpr}`,
      '',
      '  tags = local.common_tags',
      '}',
    ];

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_dns_zone',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
