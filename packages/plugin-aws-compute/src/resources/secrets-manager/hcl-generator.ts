import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const secretsManagerHclGenerator: HclGenerator = {
  typeId: 'aws/security/secrets_manager',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const description = props['description'] as string | undefined;
    const recoveryWindow = props['recovery_window_in_days'] as number | undefined;
    const kmsKeyId = props['kms_key_id'] as string | undefined;

    const nameExpr = context.getPropertyExpression(resource, 'name', name);

    const lines: string[] = [
      `resource "aws_secretsmanager_secret" "${resource.terraformName}" {`,
      `  name = ${nameExpr}`,
    ];

    if (description || resource.variableOverrides?.['description'] === 'variable') {
      const descExpr = context.getPropertyExpression(resource, 'description', description ?? '');
      lines.push(`  description = ${descExpr}`);
    }

    if (recoveryWindow !== undefined) {
      const rwExpr = context.getPropertyExpression(resource, 'recovery_window_in_days', recoveryWindow);
      lines.push(`  recovery_window_in_days = ${rwExpr}`);
    }

    if (kmsKeyId) {
      const kmsExpr = context.getPropertyExpression(resource, 'kms_key_id', kmsKeyId);
      lines.push(`  kms_key_id = ${kmsExpr}`);
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'aws_secretsmanager_secret',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
