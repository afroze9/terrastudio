import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const vnetHclGenerator: HclGenerator = {
  typeId: 'azurerm/networking/virtual_network',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const addressSpace = (props['address_space'] as string[]) ?? ['10.0.0.0/16'];
    const dnsServers = props['dns_servers'] as string[] | undefined;

    const rgExpr = context.getResourceGroupExpression();
    const locExpr = context.getLocationExpression();
    const addrList = addressSpace.map((a) => `"${a}"`).join(', ');

    const lines: string[] = [
      `resource "azurerm_virtual_network" "${resource.terraformName}" {`,
      `  name                = "${name}"`,
      `  resource_group_name = ${rgExpr}`,
      `  location            = ${locExpr}`,
      `  address_space       = [${addrList}]`,
    ];

    if (dnsServers && dnsServers.length > 0) {
      const dnsList = dnsServers.map((d) => `"${d}"`).join(', ');
      lines.push(`  dns_servers         = [${dnsList}]`);
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
