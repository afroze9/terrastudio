import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const privateDnsZoneVnetLinkHclGenerator: HclGenerator = {
  typeId: 'azurerm/networking/private_dns_zone_vnet_link',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const registrationEnabled = (props['registration_enabled'] as boolean) ?? false;

    const rgExpr = context.getResourceGroupExpression(resource);

    // Resolve Private DNS Zone reference → name
    const dnsZoneRef = resource.references['private_dns_zone_id'];
    const dnsZoneNameExpr = dnsZoneRef
      ? context.getAttributeReference(dnsZoneRef, 'name')
      : '"<private-dns-zone-name>"';

    // Resolve VNet reference → id
    const vnetRef = resource.references['virtual_network_id'];
    const vnetIdExpr = vnetRef
      ? context.getAttributeReference(vnetRef, 'id')
      : '"<virtual-network-id>"';

    const dependsOn: string[] = [];
    if (dnsZoneRef) {
      const addr = context.getTerraformAddress(dnsZoneRef);
      if (addr) dependsOn.push(addr);
    }
    if (vnetRef) {
      const addr = context.getTerraformAddress(vnetRef);
      if (addr) dependsOn.push(addr);
    }

    const lines: string[] = [
      `resource "azurerm_private_dns_zone_virtual_network_link" "${resource.terraformName}" {`,
      `  name                  = "${name}"`,
      `  resource_group_name   = ${rgExpr}`,
      `  private_dns_zone_name = ${dnsZoneNameExpr}`,
      `  virtual_network_id    = ${vnetIdExpr}`,
      `  registration_enabled  = ${registrationEnabled}`,
      '',
      '  tags = local.common_tags',
      '}',
    ];

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_private_dns_zone_virtual_network_link',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
