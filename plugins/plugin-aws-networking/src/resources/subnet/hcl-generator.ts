import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const subnetHclGenerator: HclGenerator = {
  typeId: 'aws/networking/subnet',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const cidrBlock = (props['cidr_block'] as string) ?? '10.0.1.0/24';
    const availabilityZone = props['availability_zone'] as string | undefined;
    const mapPublicIp = props['map_public_ip_on_launch'] as boolean | undefined;

    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const cidrExpr = context.getPropertyExpression(resource, 'cidr_block', cidrBlock);

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
      `resource "aws_subnet" "${resource.terraformName}" {`,
      `  vpc_id     = ${vpcIdExpr}`,
      `  cidr_block = ${cidrExpr}`,
    ];

    const azIsVar = resource.variableOverrides?.['availability_zone'] === 'variable';
    if (azIsVar || (availabilityZone !== undefined)) {
      const azExpr = context.getPropertyExpression(resource, 'availability_zone', availabilityZone ?? 'us-east-1a');
      lines.push(`  availability_zone = ${azExpr}`);
    }

    const publicIpIsVar = resource.variableOverrides?.['map_public_ip_on_launch'] === 'variable';
    if (publicIpIsVar || (mapPublicIp !== undefined && mapPublicIp !== false)) {
      const publicIpExpr = context.getPropertyExpression(resource, 'map_public_ip_on_launch', mapPublicIp ?? false);
      lines.push(`  map_public_ip_on_launch = ${publicIpExpr}`);
    }

    lines.push('');
    lines.push('  tags = merge(local.common_tags, {');
    lines.push(`    Name = ${nameExpr}`);
    lines.push('  })');
    lines.push('}');

    const blocks: HclBlock[] = [
      {
        blockType: 'resource',
        terraformType: 'aws_subnet',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];

    // Route table association via reference property
    const rtRef = resource.references['route_table_id'];
    if (rtRef) {
      const rtIdExpr = context.getAttributeReference(rtRef, 'id');
      const rtAddr = context.getTerraformAddress(rtRef);
      const rtDeps = [`aws_subnet.${resource.terraformName}`];
      if (rtAddr) rtDeps.push(rtAddr);

      blocks.push({
        blockType: 'resource',
        terraformType: 'aws_route_table_association',
        name: `${resource.terraformName}_rt`,
        content: [
          `resource "aws_route_table_association" "${resource.terraformName}_rt" {`,
          `  subnet_id      = aws_subnet.${resource.terraformName}.id`,
          `  route_table_id = ${rtIdExpr}`,
          `}`,
        ].join('\n'),
        dependsOn: rtDeps,
      });
    }

    return blocks;
  },
};
