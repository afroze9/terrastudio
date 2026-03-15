import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const cloudwatchLogGroupHclGenerator: HclGenerator = {
  typeId: 'aws/monitoring/cloudwatch_log_group',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const retention = props['retention_in_days'] as string ?? '14';

    const nameExpr = context.getPropertyExpression(resource, 'name', name);

    const lines: string[] = [
      `resource "aws_cloudwatch_log_group" "${resource.terraformName}" {`,
      `  name              = ${nameExpr}`,
    ];

    const retentionDays = Number(retention);
    if (retentionDays > 0) {
      lines.push(`  retention_in_days = ${retentionDays}`);
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'aws_cloudwatch_log_group',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
