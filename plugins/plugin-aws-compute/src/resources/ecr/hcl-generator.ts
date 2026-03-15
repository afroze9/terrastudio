import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const ecrHclGenerator: HclGenerator = {
  typeId: 'aws/containers/ecr',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const mutability = props['image_tag_mutability'] as string ?? 'MUTABLE';
    const scanOnPush = props['scan_on_push'] as boolean ?? true;
    const encryptionType = props['encryption_type'] as string ?? 'AES256';
    const forceDelete = props['force_delete'] as boolean ?? false;

    const nameExpr = context.getPropertyExpression(resource, 'name', name);

    const lines: string[] = [
      `resource "aws_ecr_repository" "${resource.terraformName}" {`,
      `  name                 = ${nameExpr}`,
      `  image_tag_mutability = "${mutability}"`,
    ];

    if (forceDelete) {
      lines.push('  force_delete = true');
    }

    lines.push('');
    lines.push('  image_scanning_configuration {');
    lines.push(`    scan_on_push = ${scanOnPush}`);
    lines.push('  }');

    if (encryptionType === 'KMS') {
      lines.push('');
      lines.push('  encryption_configuration {');
      lines.push('    encryption_type = "KMS"');
      lines.push('  }');
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'aws_ecr_repository',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
