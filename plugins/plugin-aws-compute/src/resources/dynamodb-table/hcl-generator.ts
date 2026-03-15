import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const dynamodbTableHclGenerator: HclGenerator = {
  typeId: 'aws/database/dynamodb_table',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const billingMode = (props['billing_mode'] as string) ?? 'PAY_PER_REQUEST';
    const hashKey = (props['hash_key'] as string) ?? 'id';
    const hashKeyType = (props['hash_key_type'] as string) ?? 'S';
    const rangeKey = props['range_key'] as string | undefined;
    const rangeKeyType = (props['range_key_type'] as string) ?? 'S';
    const readCapacity = Number(props['read_capacity'] ?? 5);
    const writeCapacity = Number(props['write_capacity'] ?? 5);
    const pitr = props['point_in_time_recovery'] as boolean ?? false;

    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const hashKeyExpr = context.getPropertyExpression(resource, 'hash_key', hashKey);

    const lines: string[] = [
      `resource "aws_dynamodb_table" "${resource.terraformName}" {`,
      `  name         = ${nameExpr}`,
      `  billing_mode = "${billingMode}"`,
      `  hash_key     = ${hashKeyExpr}`,
    ];

    if (rangeKey) {
      const rangeKeyExpr = context.getPropertyExpression(resource, 'range_key', rangeKey);
      lines.push(`  range_key    = ${rangeKeyExpr}`);
    }

    if (billingMode === 'PROVISIONED') {
      lines.push(`  read_capacity  = ${readCapacity}`);
      lines.push(`  write_capacity = ${writeCapacity}`);
    }

    lines.push('');
    lines.push('  attribute {');
    lines.push(`    name = ${hashKeyExpr}`);
    lines.push(`    type = "${hashKeyType}"`);
    lines.push('  }');

    if (rangeKey) {
      const rangeKeyExpr = context.getPropertyExpression(resource, 'range_key', rangeKey);
      lines.push('');
      lines.push('  attribute {');
      lines.push(`    name = ${rangeKeyExpr}`);
      lines.push(`    type = "${rangeKeyType}"`);
      lines.push('  }');
    }

    if (pitr) {
      lines.push('');
      lines.push('  point_in_time_recovery {');
      lines.push('    enabled = true');
      lines.push('  }');
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'aws_dynamodb_table',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
