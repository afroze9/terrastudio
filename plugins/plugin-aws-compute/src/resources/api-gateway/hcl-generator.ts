import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const apiGatewayHclGenerator: HclGenerator = {
  typeId: 'aws/compute/api_gateway',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const protocolType = (props['protocol_type'] as string) ?? 'HTTP';
    const description = props['description'] as string | undefined;
    const disableExecuteApiEndpoint = props['disable_execute_api_endpoint'] as boolean ?? false;
    const apiKeySelectionExpression = props['api_key_selection_expression'] as string | undefined;
    const corsEnabled = props['cors_enabled'] as boolean ?? true;
    const corsOrigins = (props['cors_allow_origins'] as string[]) ?? ['*'];

    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const protocolExpr = context.getPropertyExpression(resource, 'protocol_type', protocolType);

    const lines: string[] = [
      `resource "aws_apigatewayv2_api" "${resource.terraformName}" {`,
      `  name          = ${nameExpr}`,
      `  protocol_type = ${protocolExpr}`,
    ];

    if (description || resource.variableOverrides?.['description'] === 'variable') {
      const descExpr = context.getPropertyExpression(resource, 'description', description ?? '');
      lines.push(`  description   = ${descExpr}`);
    }

    if (disableExecuteApiEndpoint || resource.variableOverrides?.['disable_execute_api_endpoint'] === 'variable') {
      const disableEndpointExpr = context.getPropertyExpression(resource, 'disable_execute_api_endpoint', disableExecuteApiEndpoint);
      lines.push(`  disable_execute_api_endpoint = ${disableEndpointExpr}`);
    }

    if (apiKeySelectionExpression || resource.variableOverrides?.['api_key_selection_expression'] === 'variable') {
      const apiKeyExpr = context.getPropertyExpression(resource, 'api_key_selection_expression', apiKeySelectionExpression ?? '');
      lines.push(`  api_key_selection_expression = ${apiKeyExpr}`);
    }

    if (corsEnabled && protocolType === 'HTTP') {
      lines.push('');
      lines.push('  cors_configuration {');
      const originsStr = corsOrigins.map(o => `"${o}"`).join(', ');
      lines.push(`    allow_origins = [${originsStr}]`);
      lines.push('    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]');
      lines.push('    allow_headers = ["Content-Type", "Authorization"]');
      lines.push('    max_age       = 300');
      lines.push('  }');
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    const blocks: HclBlock[] = [
      {
        blockType: 'resource',
        terraformType: 'aws_apigatewayv2_api',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];

    // Auto-deploy stage
    blocks.push({
      blockType: 'resource',
      terraformType: 'aws_apigatewayv2_stage',
      name: `${resource.terraformName}_default`,
      content: [
        `resource "aws_apigatewayv2_stage" "${resource.terraformName}_default" {`,
        `  api_id      = aws_apigatewayv2_api.${resource.terraformName}.id`,
        '  name        = "$default"',
        '  auto_deploy = true',
        '}',
      ].join('\n'),
      dependsOn: [`aws_apigatewayv2_api.${resource.terraformName}`],
    });

    return blocks;
  },
};
