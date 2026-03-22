import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const publicIpHclGenerator: HclGenerator = {
  typeId: 'azurerm/networking/public_ip',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const allocationMethod = (props['allocation_method'] as string) ?? 'Static';
    const sku = (props['sku'] as string) ?? 'Standard';
    const skuTier = (props['sku_tier'] as string) ?? 'Regional';
    const ipVersion = props['ip_version'] as string | undefined;
    const idleTimeout = props['idle_timeout_in_minutes'] as number | undefined;
    const domainLabel = props['domain_name_label'] as string | undefined;
    const zones = props['zones'] as string[] | undefined;

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);
    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const allocationMethodExpr = context.getPropertyExpression(resource, 'allocation_method', allocationMethod);
    const skuExpr = context.getPropertyExpression(resource, 'sku', sku);

    const lines: string[] = [
      `resource "azurerm_public_ip" "${resource.terraformName}" {`,
      `  name                = ${nameExpr}`,
      `  resource_group_name = ${rgExpr}`,
      `  location            = ${locExpr}`,
      `  allocation_method   = ${allocationMethodExpr}`,
      `  sku                 = ${skuExpr}`,
    ];

    if (skuTier && skuTier !== 'Regional') {
      const skuTierExpr = context.getPropertyExpression(resource, 'sku_tier', skuTier);
      lines.push(`  sku_tier            = ${skuTierExpr}`);
    } else if (resource.variableOverrides?.['sku_tier'] === 'variable') {
      const skuTierExpr = context.getPropertyExpression(resource, 'sku_tier', skuTier);
      lines.push(`  sku_tier            = ${skuTierExpr}`);
    }

    if (ipVersion && ipVersion !== 'IPv4') {
      const ipVersionExpr = context.getPropertyExpression(resource, 'ip_version', ipVersion);
      lines.push(`  ip_version          = ${ipVersionExpr}`);
    }

    if (idleTimeout && idleTimeout !== 4) {
      const idleTimeoutExpr = context.getPropertyExpression(resource, 'idle_timeout_in_minutes', idleTimeout);
      lines.push(`  idle_timeout_in_minutes = ${idleTimeoutExpr}`);
    }

    if (domainLabel) {
      const domainLabelExpr = context.getPropertyExpression(resource, 'domain_name_label', domainLabel);
      lines.push(`  domain_name_label   = ${domainLabelExpr}`);
    }

    if (zones && zones.length > 0) {
      const zonesExpr = context.getPropertyExpression(resource, 'zones', zones);
      lines.push(`  zones               = ${zonesExpr}`);
    } else if (resource.variableOverrides?.['zones'] === 'variable') {
      const zonesExpr = context.getPropertyExpression(resource, 'zones', []);
      lines.push(`  zones               = ${zonesExpr}`);
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_public_ip',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
