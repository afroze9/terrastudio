import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';
import { escapeHclString as e } from '@terrastudio/core';

export const routeHclGenerator: HclGenerator = {
  typeId: 'azurerm/networking/route',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const addressPrefix = props['address_prefix'] as string;
    const nextHopType = (props['next_hop_type'] as string) ?? 'Internet';
    const nextHopIp = props['next_hop_in_ip_address'] as string | undefined;

    const rgExpr = context.getResourceGroupExpression(resource);

    const rtRef = resource.references['route_table_name'];
    const rtNameExpr = rtRef
      ? context.getAttributeReference(rtRef, 'name')
      : '"<route-table-name>"';

    const dependsOn: string[] = [];
    if (rtRef) {
      const rtAddr = context.getTerraformAddress(rtRef);
      if (rtAddr) dependsOn.push(rtAddr);
    }

    const lines: string[] = [
      `resource "azurerm_route" "${resource.terraformName}" {`,
      `  name                = "${e(name)}"`,
      `  resource_group_name = ${rgExpr}`,
      `  route_table_name    = ${rtNameExpr}`,
      `  address_prefix      = "${e(addressPrefix)}"`,
      `  next_hop_type       = "${e(nextHopType)}"`,
    ];

    if (nextHopType === 'VirtualAppliance' && nextHopIp) {
      lines.push(`  next_hop_in_ip_address = "${e(nextHopIp)}"`);
    }

    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_route',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
