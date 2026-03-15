import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const iamRoleHclGenerator: HclGenerator = {
  typeId: 'aws/security/iam_role',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const description = props['description'] as string | undefined;
    const service = (props['assume_role_service'] as string) ?? 'lambda.amazonaws.com';
    const policyArns = (props['managed_policy_arns'] as string[]) ?? [];

    const nameExpr = context.getPropertyExpression(resource, 'name', name);

    const blocks: HclBlock[] = [];

    const lines: string[] = [
      `resource "aws_iam_role" "${resource.terraformName}" {`,
      `  name = ${nameExpr}`,
    ];

    if (description) {
      const descExpr = context.getPropertyExpression(resource, 'description', description);
      lines.push(`  description = ${descExpr}`);
    }

    lines.push('');
    lines.push('  assume_role_policy = jsonencode({');
    lines.push('    Version = "2012-10-17"');
    lines.push('    Statement = [');
    lines.push('      {');
    lines.push('        Action = "sts:AssumeRole"');
    lines.push('        Effect = "Allow"');
    lines.push('        Principal = {');
    lines.push(`          Service = "${service}"`);
    lines.push('        }');
    lines.push('      }');
    lines.push('    ]');
    lines.push('  })');
    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    blocks.push({
      blockType: 'resource',
      terraformType: 'aws_iam_role',
      name: resource.terraformName,
      content: lines.join('\n'),
    });

    // Attach managed policies
    for (let i = 0; i < policyArns.length; i++) {
      const arn = policyArns[i];
      if (!arn) continue;
      blocks.push({
        blockType: 'resource',
        terraformType: 'aws_iam_role_policy_attachment',
        name: `${resource.terraformName}_policy_${i}`,
        content: [
          `resource "aws_iam_role_policy_attachment" "${resource.terraformName}_policy_${i}" {`,
          `  role       = aws_iam_role.${resource.terraformName}.name`,
          `  policy_arn = "${arn}"`,
          '}',
        ].join('\n'),
        dependsOn: [`aws_iam_role.${resource.terraformName}`],
      });
    }

    return blocks;
  },
};
