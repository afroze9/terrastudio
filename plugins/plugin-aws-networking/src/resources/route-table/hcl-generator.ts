import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';
import { escapeHclString as e } from '@terrastudio/core';

interface Route {
  destination_cidr_block: string;
  target_type: 'gateway' | 'nat_gateway' | 'network_interface' | 'vpc_peering_connection';
  target_id: string;
}

const TARGET_TYPE_TO_ARG: Record<string, string> = {
  gateway: 'gateway_id',
  nat_gateway: 'nat_gateway_id',
  network_interface: 'network_interface_id',
  vpc_peering_connection: 'vpc_peering_connection_id',
};

export const routeTableHclGenerator: HclGenerator = {
  typeId: 'aws/networking/route_table',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const routes = (props['routes'] as Route[] | undefined) ?? [];

    const nameExpr = context.getPropertyExpression(resource, 'name', name);

    // Resolve VPC reference from parent
    const vpcRef = resource.references['vpc_id'];
    const vpcIdExpr = vpcRef
      ? context.getAttributeReference(vpcRef, 'id')
      : '"<vpc-id>"';

    const dependsOn: string[] = [];
    if (vpcRef) {
      const vpcAddr = context.getTerraformAddress(vpcRef);
      if (vpcAddr) dependsOn.push(vpcAddr);
    }

    const lines: string[] = [
      `resource "aws_route_table" "${resource.terraformName}" {`,
      `  vpc_id = ${vpcIdExpr}`,
    ];

    for (const route of routes) {
      const targetArg = TARGET_TYPE_TO_ARG[route.target_type] ?? 'gateway_id';
      lines.push('');
      lines.push('  route {');
      lines.push(`    cidr_block = "${e(route.destination_cidr_block)}"`);
      lines.push(`    ${targetArg} = "${e(route.target_id)}"`);
      lines.push('  }');
    }

    lines.push('');
    lines.push('  tags = merge(local.common_tags, {');
    lines.push(`    Name = ${nameExpr}`);
    lines.push('  })');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'aws_route_table',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
