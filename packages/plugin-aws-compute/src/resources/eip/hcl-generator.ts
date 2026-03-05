import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const eipHclGenerator: HclGenerator = {
  typeId: 'aws/compute/eip',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const domain = (props['domain'] as string) ?? 'vpc';

    const domainExpr = context.getPropertyExpression(resource, 'domain', domain);

    const lines: string[] = [
      `resource "aws_eip" "${resource.terraformName}" {`,
      `  domain = ${domainExpr}`,
      '',
      '  tags = local.common_tags',
      '}',
    ];

    return [
      {
        blockType: 'resource',
        terraformType: 'aws_eip',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
