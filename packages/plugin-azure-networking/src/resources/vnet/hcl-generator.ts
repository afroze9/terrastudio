import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const vnetHclGenerator: HclGenerator = {
  typeId: 'azurerm/networking/virtual_network',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const addressSpace = (props['address_space'] as string[]) ?? ['10.0.0.0/16'];
    const dnsServers = props['dns_servers'] as string[] | undefined;

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);
    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const addrExpr = context.getPropertyExpression(resource, 'address_space', addressSpace);

    const lines: string[] = [
      `resource "azurerm_virtual_network" "${resource.terraformName}" {`,
      `  name                = ${nameExpr}`,
      `  resource_group_name = ${rgExpr}`,
      `  location            = ${locExpr}`,
      `  address_space       = ${addrExpr}`,
    ];

    const dnsIsVar = resource.variableOverrides?.['dns_servers'] === 'variable';
    if (dnsIsVar || (dnsServers && dnsServers.length > 0)) {
      lines.push(`  dns_servers         = ${context.getPropertyExpression(resource, 'dns_servers', dnsServers ?? [])}`);
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_virtual_network',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
