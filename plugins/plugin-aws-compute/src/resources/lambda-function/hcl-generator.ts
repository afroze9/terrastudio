import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const lambdaFunctionHclGenerator: HclGenerator = {
  typeId: 'aws/compute/lambda_function',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const runtime = (props['runtime'] as string) ?? 'nodejs20.x';
    const handler = (props['handler'] as string) ?? 'index.handler';
    const memorySize = Number(props['memory_size'] ?? 128);
    const timeout = Number(props['timeout'] ?? 30);
    const description = props['description'] as string | undefined;
    const envVars = props['environment_variables'] as Record<string, string> | undefined;

    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const runtimeExpr = context.getPropertyExpression(resource, 'runtime', runtime);
    const handlerExpr = context.getPropertyExpression(resource, 'handler', handler);
    const memorySizeExpr = context.getPropertyExpression(resource, 'memory_size', memorySize);
    const timeoutExpr = context.getPropertyExpression(resource, 'timeout', timeout);

    const dependsOn: string[] = [];

    const lines: string[] = [
      `resource "aws_lambda_function" "${resource.terraformName}" {`,
      `  function_name = ${nameExpr}`,
      `  runtime       = ${runtimeExpr}`,
      `  handler       = ${handlerExpr}`,
      `  memory_size   = ${memorySizeExpr}`,
      `  timeout       = ${timeoutExpr}`,
    ];

    // IAM role reference
    const roleRef = resource.references['role_arn'];
    if (roleRef) {
      const roleArnExpr = context.getAttributeReference(roleRef, 'arn');
      lines.push(`  role          = ${roleArnExpr}`);
      const roleAddr = context.getTerraformAddress(roleRef);
      if (roleAddr) dependsOn.push(roleAddr);
    } else {
      lines.push('  role          = "<iam-role-arn>"');
    }

    if (description) {
      const descExpr = context.getPropertyExpression(resource, 'description', description);
      lines.push(`  description   = ${descExpr}`);
    }

    // Deployment package
    const deploymentSource = (props['deployment_source'] as string) ?? 'local_file';
    lines.push('');
    if (deploymentSource === 's3') {
      const s3Bucket = props['s3_bucket'] as string | undefined;
      const s3Key = props['s3_key'] as string | undefined;
      if (s3Bucket || resource.variableOverrides?.['s3_bucket'] === 'variable') {
        const s3BucketExpr = context.getPropertyExpression(resource, 's3_bucket', s3Bucket ?? '');
        lines.push(`  s3_bucket     = ${s3BucketExpr}`);
      }
      if (s3Key || resource.variableOverrides?.['s3_key'] === 'variable') {
        const s3KeyExpr = context.getPropertyExpression(resource, 's3_key', s3Key ?? '');
        lines.push(`  s3_key        = ${s3KeyExpr}`);
      }
    } else {
      const filename = (props['filename'] as string) ?? 'lambda.zip';
      const filenameExpr = context.getPropertyExpression(resource, 'filename', filename);
      lines.push(`  filename      = ${filenameExpr}`);
    }

    // Environment variables
    if (envVars && Object.keys(envVars).length > 0) {
      lines.push('');
      lines.push('  environment {');
      lines.push('    variables = {');
      for (const [k, v] of Object.entries(envVars)) {
        lines.push(`      ${k} = "${v}"`);
      }
      lines.push('    }');
      lines.push('  }');
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'aws_lambda_function',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
