import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const privateEndpointHclGenerator: HclGenerator = {
  typeId: 'azurerm/networking/private_endpoint',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const subresource = (props['subresource_names'] as string) ?? 'blob';
    const dnsEnabled = (props['dns_zone_enabled'] as boolean) ?? false;

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);

    // Resolve subnet reference (parent)
    const subnetRef = resource.references['subnet_id'];
    const subnetIdExpr = subnetRef
      ? context.getAttributeReference(subnetRef, 'id')
      : '"<subnet-id>"';

    // Resolve target PaaS resource reference
    const targetRef = resource.references['target_resource_id'];
    const targetIdExpr = targetRef
      ? context.getAttributeReference(targetRef, 'id')
      : '"<target-resource-id>"';

    const dependsOn: string[] = [];
    if (subnetRef) {
      const addr = context.getTerraformAddress(subnetRef);
      if (addr) dependsOn.push(addr);
    }
    if (targetRef) {
      const addr = context.getTerraformAddress(targetRef);
      if (addr) dependsOn.push(addr);
    }

    const lines: string[] = [
      `resource "azurerm_private_endpoint" "${resource.terraformName}" {`,
      `  name                = "${name}"`,
      `  resource_group_name = ${rgExpr}`,
      `  location            = ${locExpr}`,
      `  subnet_id           = ${subnetIdExpr}`,
      '',
      '  private_service_connection {',
      `    name                           = "${name}-psc"`,
      `    private_connection_resource_id = ${targetIdExpr}`,
      `    subresource_names              = ["${subresource}"]`,
      '    is_manual_connection           = false',
      '  }',
    ];

    // Optional Private DNS Zone group
    const dnsZoneRef = resource.references['dns_zone_id'];
    if (dnsEnabled && dnsZoneRef) {
      const dnsZoneIdExpr = context.getAttributeReference(dnsZoneRef, 'id');
      const dnsAddr = context.getTerraformAddress(dnsZoneRef);
      if (dnsAddr) dependsOn.push(dnsAddr);

      lines.push('');
      lines.push('  private_dns_zone_group {');
      lines.push(`    name                 = "${name}-dns"`);
      lines.push(`    private_dns_zone_ids = [${dnsZoneIdExpr}]`);
      lines.push('  }');
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_private_endpoint',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
