import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const routeHclGenerator: HclGenerator = {
  typeId: 'azurerm/networking/route',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const addressPrefix = props['address_prefix'] as string;
    const nextHopType = (props['next_hop_type'] as string) ?? 'Internet';
    const nextHopIp = props['next_hop_in_ip_address'] as string | undefined;

    const rgExpr = context.getResourceGroupExpression(resource);
    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const addressPrefixExpr = context.getPropertyExpression(resource, 'address_prefix', addressPrefix);
    const nextHopTypeExpr = context.getPropertyExpression(resource, 'next_hop_type', nextHopType);

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
      `  name                = ${nameExpr}`,
      `  resource_group_name = ${rgExpr}`,
      `  route_table_name    = ${rtNameExpr}`,
      `  address_prefix      = ${addressPrefixExpr}`,
      `  next_hop_type       = ${nextHopTypeExpr}`,
    ];

    if (nextHopType === 'VirtualAppliance' && nextHopIp) {
      const nextHopIpExpr = context.getPropertyExpression(resource, 'next_hop_in_ip_address', nextHopIp);
      lines.push(`  next_hop_in_ip_address = ${nextHopIpExpr}`);
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
