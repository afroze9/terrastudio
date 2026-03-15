import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const s3BucketHclGenerator: HclGenerator = {
  typeId: 'aws/storage/s3_bucket',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const forceDestroy = props['force_destroy'] as boolean ?? false;

    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const forceDestroyExpr = context.getPropertyExpression(resource, 'force_destroy', forceDestroy);

    const blocks: HclBlock[] = [];

    // Main bucket resource
    const lines: string[] = [
      `resource "aws_s3_bucket" "${resource.terraformName}" {`,
      `  bucket        = ${nameExpr}`,
      `  force_destroy = ${forceDestroyExpr}`,
      '',
      '  tags = local.common_tags',
      '}',
    ];

    blocks.push({
      blockType: 'resource',
      terraformType: 'aws_s3_bucket',
      name: resource.terraformName,
      content: lines.join('\n'),
    });

    // Versioning configuration
    const versioningEnabled = props['versioning_enabled'] as boolean ?? false;
    if (versioningEnabled) {
      blocks.push({
        blockType: 'resource',
        terraformType: 'aws_s3_bucket_versioning',
        name: `${resource.terraformName}_versioning`,
        content: [
          `resource "aws_s3_bucket_versioning" "${resource.terraformName}_versioning" {`,
          `  bucket = aws_s3_bucket.${resource.terraformName}.id`,
          '',
          '  versioning_configuration {',
          '    status = "Enabled"',
          '  }',
          '}',
        ].join('\n'),
        dependsOn: [`aws_s3_bucket.${resource.terraformName}`],
      });
    }

    // Server-side encryption
    const encryption = (props['encryption'] as string) ?? 'AES256';
    blocks.push({
      blockType: 'resource',
      terraformType: 'aws_s3_bucket_server_side_encryption_configuration',
      name: `${resource.terraformName}_sse`,
      content: [
        `resource "aws_s3_bucket_server_side_encryption_configuration" "${resource.terraformName}_sse" {`,
        `  bucket = aws_s3_bucket.${resource.terraformName}.id`,
        '',
        '  rule {',
        '    apply_server_side_encryption_by_default {',
        `      sse_algorithm = "${encryption}"`,
        '    }',
        '  }',
        '}',
      ].join('\n'),
      dependsOn: [`aws_s3_bucket.${resource.terraformName}`],
    });

    return blocks;
  },
};
