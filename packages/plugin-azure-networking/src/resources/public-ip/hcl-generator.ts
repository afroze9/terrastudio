import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const publicIpHclGenerator: HclGenerator = {
  typeId: 'azurerm/networking/public_ip',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const allocationMethod = (props['allocation_method'] as string) ?? 'Static';
    const sku = (props['sku'] as string) ?? 'Standard';
    const ipVersion = props['ip_version'] as string | undefined;
    const idleTimeout = props['idle_timeout_in_minutes'] as number | undefined;
    const domainLabel = props['domain_name_label'] as string | undefined;

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);

    const lines: string[] = [
      `resource "azurerm_public_ip" "${resource.terraformName}" {`,
      `  name                = "${name}"`,
      `  resource_group_name = ${rgExpr}`,
      `  location            = ${locExpr}`,
      `  allocation_method   = "${allocationMethod}"`,
      `  sku                 = "${sku}"`,
    ];

    if (ipVersion && ipVersion !== 'IPv4') {
      lines.push(`  ip_version          = "${ipVersion}"`);
    }

    if (idleTimeout && idleTimeout !== 4) {
      lines.push(`  idle_timeout_in_minutes = ${idleTimeout}`);
    }

    if (domainLabel) {
      lines.push(`  domain_name_label   = "${domainLabel}"`);
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
