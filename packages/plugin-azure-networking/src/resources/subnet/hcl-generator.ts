import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const subnetHclGenerator: HclGenerator = {
  typeId: 'azurerm/networking/subnet',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const addressPrefixes = (props['address_prefixes'] as string[]) ?? ['10.0.1.0/24'];
    const serviceEndpoints = props['service_endpoints'] as string[] | undefined;

    const rgExpr = context.getResourceGroupExpression();

    // Resolve VNet reference
    const vnetRef = resource.references['virtual_network_name'];
    const vnetNameExpr = vnetRef
      ? context.getAttributeReference(vnetRef, 'name')
      : '"<vnet-name>"';

    const addrList = addressPrefixes.map((a) => `"${a}"`).join(', ');
    const dependsOn: string[] = [];

    if (vnetRef) {
      const vnetAddr = context.getTerraformAddress(vnetRef);
      if (vnetAddr) dependsOn.push(vnetAddr);
    }

    const lines: string[] = [
      `resource "azurerm_subnet" "${resource.terraformName}" {`,
      `  name                 = "${name}"`,
      `  resource_group_name  = ${rgExpr}`,
      `  virtual_network_name = ${vnetNameExpr}`,
      `  address_prefixes     = [${addrList}]`,
    ];

    if (serviceEndpoints && serviceEndpoints.length > 0) {
      const epList = serviceEndpoints.map((e) => `"${e}"`).join(', ');
      lines.push(`  service_endpoints    = [${epList}]`);
    }

    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_subnet',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
