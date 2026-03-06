import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const efsHclGenerator: HclGenerator = {
  typeId: 'aws/storage/efs',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const perfMode = props['performance_mode'] as string ?? 'generalPurpose';
    const throughputMode = props['throughput_mode'] as string ?? 'bursting';
    const encrypted = props['encrypted'] as boolean ?? true;
    const lifecyclePolicy = props['lifecycle_policy'] as string ?? '';

    const nameExpr = context.getPropertyExpression(resource, 'name', name);

    const lines: string[] = [
      `resource "aws_efs_file_system" "${resource.terraformName}" {`,
      `  creation_token   = ${nameExpr}`,
      `  performance_mode = "${perfMode}"`,
      `  throughput_mode  = "${throughputMode}"`,
      `  encrypted        = ${encrypted}`,
    ];

    if (lifecyclePolicy) {
      lines.push('');
      lines.push('  lifecycle_policy {');
      lines.push(`    transition_to_ia = "${lifecyclePolicy}"`);
      lines.push('  }');
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'aws_efs_file_system',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
