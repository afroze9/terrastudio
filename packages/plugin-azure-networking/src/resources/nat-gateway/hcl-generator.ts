import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';
import { escapeHclString as e } from '@terrastudio/core';

export const natGatewayHclGenerator: HclGenerator = {
  typeId: 'azurerm/networking/nat_gateway',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const idleTimeout = props['idle_timeout_in_minutes'] as number | undefined;

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);

    const lines: string[] = [
      `resource "azurerm_nat_gateway" "${resource.terraformName}" {`,
      `  name                = "${e(name)}"`,
      `  location            = ${locExpr}`,
      `  resource_group_name = ${rgExpr}`,
      '  sku_name            = "Standard"',
    ];

    if (idleTimeout !== undefined && idleTimeout !== 4) {
      lines.push(`  idle_timeout_in_minutes = ${idleTimeout}`);
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    const blocks: HclBlock[] = [
      {
        blockType: 'resource',
        terraformType: 'azurerm_nat_gateway',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];

    // Public IP association
    const pipRef = resource.references['pip_id'];
    if (pipRef) {
      const pipIdExpr = context.getAttributeReference(pipRef, 'id');
      const pipAddr = context.getTerraformAddress(pipRef);
      const pipDeps = [`azurerm_nat_gateway.${resource.terraformName}`];
      if (pipAddr) pipDeps.push(pipAddr);

      blocks.push({
        blockType: 'resource',
        terraformType: 'azurerm_nat_gateway_public_ip_association',
        name: `${resource.terraformName}_pip`,
        content: [
          `resource "azurerm_nat_gateway_public_ip_association" "${resource.terraformName}_pip" {`,
          `  nat_gateway_id       = azurerm_nat_gateway.${resource.terraformName}.id`,
          `  public_ip_address_id = ${pipIdExpr}`,
          `}`,
        ].join('\n'),
        dependsOn: pipDeps,
      });
    }

    return blocks;
  },
};
