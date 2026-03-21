import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';
import { escapeHclString as e } from '@terrastudio/core';

interface LifecycleRule {
  id: string;
  status?: string;
  prefix?: string;
  transition_days?: number;
  transition_storage_class?: string;
  expiration_days?: number;
}

export const s3BucketHclGenerator: HclGenerator = {
  typeId: 'aws/storage/s3_bucket',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const forceDestroy = props['force_destroy'] as boolean ?? false;

    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const forceDestroyExpr = context.getPropertyExpression(resource, 'force_destroy', forceDestroy);

    const blocks: HclBlock[] = [];
    const bucketRef = `aws_s3_bucket.${resource.terraformName}`;

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
          `  bucket = ${bucketRef}.id`,
          '',
          '  versioning_configuration {',
          '    status = "Enabled"',
          '  }',
          '}',
        ].join('\n'),
        dependsOn: [bucketRef],
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
        `  bucket = ${bucketRef}.id`,
        '',
        '  rule {',
        '    apply_server_side_encryption_by_default {',
        `      sse_algorithm = "${e(encryption)}"`,
        '    }',
        '  }',
        '}',
      ].join('\n'),
      dependsOn: [bucketRef],
    });

    // Lifecycle configuration
    const lifecycleRules = (props['lifecycle_rules'] as LifecycleRule[]) ?? [];
    if (lifecycleRules.length > 0) {
      const lcLines: string[] = [
        `resource "aws_s3_bucket_lifecycle_configuration" "${resource.terraformName}_lifecycle" {`,
        `  bucket = ${bucketRef}.id`,
      ];

      for (const rule of lifecycleRules) {
        lcLines.push('');
        lcLines.push('  rule {');
        lcLines.push(`    id     = "${e(rule.id)}"`);
        lcLines.push(`    status = "${e(rule.status ?? 'Enabled')}"`);

        if (rule.prefix) {
          lcLines.push('');
          lcLines.push('    filter {');
          lcLines.push(`      prefix = "${e(rule.prefix)}"`);
          lcLines.push('    }');
        } else {
          lcLines.push('');
          lcLines.push('    filter {}');
        }

        if (rule.transition_days != null && rule.transition_storage_class) {
          lcLines.push('');
          lcLines.push('    transition {');
          lcLines.push(`      days          = ${rule.transition_days}`);
          lcLines.push(`      storage_class = "${e(rule.transition_storage_class)}"`);
          lcLines.push('    }');
        }

        if (rule.expiration_days != null) {
          lcLines.push('');
          lcLines.push('    expiration {');
          lcLines.push(`      days = ${rule.expiration_days}`);
          lcLines.push('    }');
        }

        lcLines.push('  }');
      }

      lcLines.push('}');

      blocks.push({
        blockType: 'resource',
        terraformType: 'aws_s3_bucket_lifecycle_configuration',
        name: `${resource.terraformName}_lifecycle`,
        content: lcLines.join('\n'),
        dependsOn: [bucketRef],
      });
    }

    // CORS configuration
    const corsEnabled = props['cors_enabled'] as boolean ?? false;
    if (corsEnabled) {
      const allowedOrigins = (props['cors_allowed_origins'] as string[]) ?? [];
      const allowedMethods = (props['cors_allowed_methods'] as string[]) ?? [];

      if (allowedOrigins.length > 0 || allowedMethods.length > 0) {
        const corsLines: string[] = [
          `resource "aws_s3_bucket_cors_configuration" "${resource.terraformName}_cors" {`,
          `  bucket = ${bucketRef}.id`,
          '',
          '  cors_rule {',
        ];

        if (allowedOrigins.length > 0) {
          const origins = allowedOrigins.map((o) => `"${e(o)}"`).join(', ');
          corsLines.push(`    allowed_origins = [${origins}]`);
        }

        if (allowedMethods.length > 0) {
          const methods = allowedMethods.map((m) => `"${e(m)}"`).join(', ');
          corsLines.push(`    allowed_methods = [${methods}]`);
        }

        corsLines.push('  }');
        corsLines.push('}');

        blocks.push({
          blockType: 'resource',
          terraformType: 'aws_s3_bucket_cors_configuration',
          name: `${resource.terraformName}_cors`,
          content: corsLines.join('\n'),
          dependsOn: [bucketRef],
        });
      }
    }

    return blocks;
  },
};
