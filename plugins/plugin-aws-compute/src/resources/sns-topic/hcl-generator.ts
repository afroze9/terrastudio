import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const snsTopicHclGenerator: HclGenerator = {
  typeId: 'aws/messaging/sns_topic',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const fifo = props['fifo_topic'] as boolean ?? false;
    const displayName = props['display_name'] as string | undefined;
    const kmsKeyId = props['kms_master_key_id'] as string | undefined;

    const nameExpr = context.getPropertyExpression(resource, 'name', name);

    const lines: string[] = [
      `resource "aws_sns_topic" "${resource.terraformName}" {`,
      `  name = ${nameExpr}`,
    ];

    if (fifo) {
      lines.push('  fifo_topic                  = true');
      lines.push('  content_based_deduplication = true');
    }

    if (displayName) {
      const displayNameExpr = context.getPropertyExpression(resource, 'display_name', displayName);
      lines.push(`  display_name = ${displayNameExpr}`);
    }

    const kmsIsVar = resource.variableOverrides?.['kms_master_key_id'] === 'variable';
    if (kmsIsVar || kmsKeyId) {
      const kmsExpr = context.getPropertyExpression(resource, 'kms_master_key_id', kmsKeyId ?? '');
      lines.push(`  kms_master_key_id = ${kmsExpr}`);
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'aws_sns_topic',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
