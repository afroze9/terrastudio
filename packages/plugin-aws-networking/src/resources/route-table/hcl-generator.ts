import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const routeTableHclGenerator: HclGenerator = {
  typeId: 'aws/networking/route_table',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;

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
      '',
      '  tags = merge(local.common_tags, {',
      `    Name = ${nameExpr}`,
      '  })',
      '}',
    ];

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
