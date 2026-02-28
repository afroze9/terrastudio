import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';
import { escapeHclString as e } from '@terrastudio/core';

interface SecurityRule {
  name: string;
  priority: number;
  direction: string;
  access: string;
  protocol: string;
  source_port_range: string;
  destination_port_range: string;
  source_address_prefix: string;
  destination_address_prefix: string;
}

export const nsgHclGenerator: HclGenerator = {
  typeId: 'azurerm/networking/network_security_group',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const rules = (props['security_rules'] as SecurityRule[] | undefined) ?? [];

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);

    const lines: string[] = [
      `resource "azurerm_network_security_group" "${resource.terraformName}" {`,
      `  name                = "${e(name)}"`,
      `  resource_group_name = ${rgExpr}`,
      `  location            = ${locExpr}`,
    ];

    for (const rule of rules) {
      lines.push('');
      lines.push('  security_rule {');
      lines.push(`    name                       = "${e(rule.name)}"`);
      lines.push(`    priority                   = ${rule.priority}`);
      lines.push(`    direction                  = "${e(rule.direction)}"`);
      lines.push(`    access                     = "${e(rule.access)}"`);
      lines.push(`    protocol                   = "${e(rule.protocol)}"`);
      lines.push(`    source_port_range          = "${e(rule.source_port_range)}"`);
      lines.push(`    destination_port_range     = "${e(rule.destination_port_range)}"`);
      lines.push(`    source_address_prefix      = "${e(rule.source_address_prefix)}"`);
      lines.push(`    destination_address_prefix = "${e(rule.destination_address_prefix)}"`);
      lines.push('  }');
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_network_security_group',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
