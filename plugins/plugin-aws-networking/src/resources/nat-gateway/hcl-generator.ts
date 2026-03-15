import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const natGatewayHclGenerator: HclGenerator = {
  typeId: 'aws/networking/nat_gateway',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const connectivityType = (props['connectivity_type'] as string) ?? 'public';

    const nameExpr = context.getPropertyExpression(resource, 'name', name);

    // Resolve subnet reference from parent
    const subnetRef = resource.references['subnet_id'];
    const subnetIdExpr = subnetRef
      ? context.getAttributeReference(subnetRef, 'id')
      : '"<subnet-id>"';

    const dependsOn: string[] = [];
    if (subnetRef) {
      const subnetAddr = context.getTerraformAddress(subnetRef);
      if (subnetAddr) dependsOn.push(subnetAddr);
    }

    const lines: string[] = [
      `resource "aws_nat_gateway" "${resource.terraformName}" {`,
      `  subnet_id = ${subnetIdExpr}`,
    ];

    // Resolve allocation_id (Elastic IP) reference if present
    const eipRef = resource.references['allocation_id'];
    if (eipRef) {
      const eipIdExpr = context.getAttributeReference(eipRef, 'id');
      lines.push(`  allocation_id = ${eipIdExpr}`);
      const eipAddr = context.getTerraformAddress(eipRef);
      if (eipAddr) dependsOn.push(eipAddr);
    }

    const connectivityIsVar = resource.variableOverrides?.['connectivity_type'] === 'variable';
    if (connectivityIsVar || connectivityType !== 'public') {
      const connectivityExpr = context.getPropertyExpression(resource, 'connectivity_type', connectivityType);
      lines.push(`  connectivity_type = ${connectivityExpr}`);
    }

    lines.push('');
    lines.push('  tags = merge(local.common_tags, {');
    lines.push(`    Name = ${nameExpr}`);
    lines.push('  })');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'aws_nat_gateway',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
