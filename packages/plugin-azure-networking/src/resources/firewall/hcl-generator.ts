import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const firewallHclGenerator: HclGenerator = {
  typeId: 'azurerm/networking/firewall',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const skuName = (props['sku_name'] as string) ?? 'AZFW_VNet';
    const skuTier = (props['sku_tier'] as string) ?? 'Standard';
    const threatIntelMode = props['threat_intel_mode'] as string | undefined;
    const dnsProxyEnabled = props['dns_proxy_enabled'] as boolean | undefined;
    const dnsServers = props['dns_servers'] as string[] | undefined;
    const zones = props['zones'] as string[] | undefined;
    const firewallPolicyId = props['firewall_policy_id'] as string | undefined;

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);
    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const skuNameExpr = context.getPropertyExpression(resource, 'sku_name', skuName);
    const skuTierExpr = context.getPropertyExpression(resource, 'sku_tier', skuTier);

    const subnetRef = resource.references['subnet_id'];
    const subnetIdExpr = subnetRef
      ? context.getAttributeReference(subnetRef, 'id')
      : '"<subnet-id>"';

    const pipRef = resource.references['pip_id'];
    const pipIdExpr = pipRef
      ? context.getAttributeReference(pipRef, 'id')
      : '"<public-ip-id>"';

    const dependsOn: string[] = [];
    if (subnetRef) {
      const addr = context.getTerraformAddress(subnetRef);
      if (addr) dependsOn.push(addr);
    }
    if (pipRef) {
      const addr = context.getTerraformAddress(pipRef);
      if (addr) dependsOn.push(addr);
    }

    const lines: string[] = [
      `resource "azurerm_firewall" "${resource.terraformName}" {`,
      `  name                = ${nameExpr}`,
      `  location            = ${locExpr}`,
      `  resource_group_name = ${rgExpr}`,
      `  sku_name            = ${skuNameExpr}`,
      `  sku_tier            = ${skuTierExpr}`,
    ];

    // Threat intelligence mode (only emit if non-default)
    if (threatIntelMode && threatIntelMode !== 'Alert') {
      const threatExpr = context.getPropertyExpression(resource, 'threat_intel_mode', threatIntelMode);
      lines.push(`  threat_intel_mode  = ${threatExpr}`);
    } else if (resource.variableOverrides?.['threat_intel_mode'] === 'variable') {
      const threatExpr = context.getPropertyExpression(resource, 'threat_intel_mode', threatIntelMode ?? 'Alert');
      lines.push(`  threat_intel_mode  = ${threatExpr}`);
    }

    // DNS proxy
    if (dnsProxyEnabled === true) {
      const dnsProxyExpr = context.getPropertyExpression(resource, 'dns_proxy_enabled', true);
      lines.push(`  dns_proxy_enabled  = ${dnsProxyExpr}`);
    } else if (resource.variableOverrides?.['dns_proxy_enabled'] === 'variable') {
      const dnsProxyExpr = context.getPropertyExpression(resource, 'dns_proxy_enabled', false);
      lines.push(`  dns_proxy_enabled  = ${dnsProxyExpr}`);
    }

    // DNS servers
    if (dnsServers && dnsServers.length > 0) {
      const dnsExpr = context.getPropertyExpression(resource, 'dns_servers', dnsServers);
      lines.push(`  dns_servers        = ${dnsExpr}`);
    } else if (resource.variableOverrides?.['dns_servers'] === 'variable') {
      const dnsExpr = context.getPropertyExpression(resource, 'dns_servers', []);
      lines.push(`  dns_servers        = ${dnsExpr}`);
    }

    // Availability zones
    if (zones && zones.length > 0) {
      const zonesStr = `[${zones.map((z) => `"${z}"`).join(', ')}]`;
      lines.push(`  zones              = ${zonesStr}`);
    }

    // Firewall policy
    if (firewallPolicyId) {
      const policyExpr = context.getPropertyExpression(resource, 'firewall_policy_id', firewallPolicyId);
      lines.push(`  firewall_policy_id = ${policyExpr}`);
    } else if (resource.variableOverrides?.['firewall_policy_id'] === 'variable') {
      const policyExpr = context.getPropertyExpression(resource, 'firewall_policy_id', '');
      lines.push(`  firewall_policy_id = ${policyExpr}`);
    }

    // IP configuration block
    lines.push('');
    lines.push('  ip_configuration {');
    lines.push('    name                 = "configuration"');
    lines.push(`    subnet_id            = ${subnetIdExpr}`);
    lines.push(`    public_ip_address_id = ${pipIdExpr}`);
    lines.push('  }');

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_firewall',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
