import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const eipHclGenerator: HclGenerator = {
  typeId: 'aws/compute/eip',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const domain = (props['domain'] as string) ?? 'vpc';

    const domainExpr = context.getPropertyExpression(resource, 'domain', domain);

    const dependsOn: string[] = [];
    const lines: string[] = [
      `resource "aws_eip" "${resource.terraformName}" {`,
      `  domain = ${domainExpr}`,
    ];

    // EC2 instance association via edge
    const instanceRef = resource.references['instance_id'];
    if (instanceRef) {
      const instanceIdExpr = context.getAttributeReference(instanceRef, 'id');
      lines.push(`  instance_id = ${instanceIdExpr}`);
      const addr = context.getTerraformAddress(instanceRef);
      if (addr) dependsOn.push(addr);
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'aws_eip',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
