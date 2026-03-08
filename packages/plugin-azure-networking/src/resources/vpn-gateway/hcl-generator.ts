import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const vpnGatewayHclGenerator: HclGenerator = {
  typeId: 'azurerm/networking/virtual_network_gateway',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const gwType = (props['type'] as string) ?? 'Vpn';
    const vpnType = (props['vpn_type'] as string) ?? 'RouteBased';
    const sku = (props['sku'] as string) ?? 'VpnGw1';
    const generation = props['generation'] as string | undefined;
    const activeActive = props['active_active'] as boolean | undefined;
    const enableBgp = props['enable_bgp'] as boolean | undefined;
    const bgpAsn = props['bgp_asn'] as number | undefined;

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);
    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const typeExpr = context.getPropertyExpression(resource, 'type', gwType);
    const skuExpr = context.getPropertyExpression(resource, 'sku', sku);

    const subnetRef = resource.references['subnet_id'];
    const subnetIdExpr = subnetRef
      ? context.getAttributeReference(subnetRef, 'id')
      : '"<gateway-subnet-id>"';

    const pipRef = resource.references['pip_id'];
    const pipIdExpr = pipRef
      ? context.getAttributeReference(pipRef, 'id')
      : '"<public-ip-id>"';

    const pip2Ref = resource.references['pip2_id'];
    const pip2IdExpr = pip2Ref
      ? context.getAttributeReference(pip2Ref, 'id')
      : '"<public-ip-2-id>"';

    const dependsOn: string[] = [];
    if (subnetRef) {
      const addr = context.getTerraformAddress(subnetRef);
      if (addr) dependsOn.push(addr);
    }
    if (pipRef) {
      const addr = context.getTerraformAddress(pipRef);
      if (addr) dependsOn.push(addr);
    }
    if (pip2Ref) {
      const addr = context.getTerraformAddress(pip2Ref);
      if (addr) dependsOn.push(addr);
    }

    const lines: string[] = [
      `resource "azurerm_virtual_network_gateway" "${resource.terraformName}" {`,
      `  name                = ${nameExpr}`,
      `  location            = ${locExpr}`,
      `  resource_group_name = ${rgExpr}`,
      `  type                = ${typeExpr}`,
      `  sku                 = ${skuExpr}`,
    ];

    // VPN type (only for VPN gateways)
    if (gwType === 'Vpn') {
      const vpnTypeExpr = context.getPropertyExpression(resource, 'vpn_type', vpnType);
      lines.push(`  vpn_type            = ${vpnTypeExpr}`);
    }

    // Generation
    if (generation && generation !== 'None') {
      const genExpr = context.getPropertyExpression(resource, 'generation', generation);
      lines.push(`  generation          = ${genExpr}`);
    } else if (resource.variableOverrides?.['generation'] === 'variable') {
      const genExpr = context.getPropertyExpression(resource, 'generation', generation ?? 'Generation1');
      lines.push(`  generation          = ${genExpr}`);
    }

    // Active-active
    if (activeActive === true) {
      const aaExpr = context.getPropertyExpression(resource, 'active_active', true);
      lines.push(`  active_active       = ${aaExpr}`);
    } else if (resource.variableOverrides?.['active_active'] === 'variable') {
      const aaExpr = context.getPropertyExpression(resource, 'active_active', false);
      lines.push(`  active_active       = ${aaExpr}`);
    }

    // Enable BGP
    if (enableBgp === true) {
      const bgpExpr = context.getPropertyExpression(resource, 'enable_bgp', true);
      lines.push(`  enable_bgp          = ${bgpExpr}`);
    } else if (resource.variableOverrides?.['enable_bgp'] === 'variable') {
      const bgpExpr = context.getPropertyExpression(resource, 'enable_bgp', false);
      lines.push(`  enable_bgp          = ${bgpExpr}`);
    }

    // Primary IP configuration
    lines.push('');
    lines.push('  ip_configuration {');
    lines.push('    name                          = "vnetGatewayConfig"');
    lines.push(`    subnet_id                     = ${subnetIdExpr}`);
    lines.push(`    public_ip_address_id          = ${pipIdExpr}`);
    lines.push('    private_ip_address_allocation = "Dynamic"');
    lines.push('  }');

    // Second IP configuration for active-active
    if (activeActive === true) {
      lines.push('');
      lines.push('  ip_configuration {');
      lines.push('    name                          = "vnetGatewayConfig2"');
      lines.push(`    subnet_id                     = ${subnetIdExpr}`);
      lines.push(`    public_ip_address_id          = ${pip2IdExpr}`);
      lines.push('    private_ip_address_allocation = "Dynamic"');
      lines.push('  }');
    }

    // BGP settings
    if (enableBgp === true && bgpAsn !== undefined && bgpAsn !== 65515) {
      const asnExpr = context.getPropertyExpression(resource, 'bgp_asn', bgpAsn);
      lines.push('');
      lines.push('  bgp_settings {');
      lines.push(`    asn = ${asnExpr}`);
      lines.push('  }');
    } else if (resource.variableOverrides?.['bgp_asn'] === 'variable') {
      const asnExpr = context.getPropertyExpression(resource, 'bgp_asn', bgpAsn ?? 65515);
      lines.push('');
      lines.push('  bgp_settings {');
      lines.push(`    asn = ${asnExpr}`);
      lines.push('  }');
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_virtual_network_gateway',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
