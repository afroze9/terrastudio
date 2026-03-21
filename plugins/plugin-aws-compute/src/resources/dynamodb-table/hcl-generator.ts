import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';
import { escapeHclString as e } from '@terrastudio/core';

interface GlobalSecondaryIndex {
  name: string;
  hash_key: string;
  range_key?: string;
  projection_type: string;
  read_capacity?: number;
  write_capacity?: number;
}

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
    const ttlEnabled = props['ttl_enabled'] as boolean ?? false;
    const ttlAttributeName = props['ttl_attribute_name'] as string | undefined;
    const streamEnabled = props['stream_enabled'] as boolean ?? false;
    const streamViewType = props['stream_view_type'] as string | undefined;
    const gsis = (props['global_secondary_indexes'] as GlobalSecondaryIndex[] | undefined) ?? [];

    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const hashKeyExpr = context.getPropertyExpression(resource, 'hash_key', hashKey);

    const lines: string[] = [
      `resource "aws_dynamodb_table" "${resource.terraformName}" {`,
      `  name         = ${nameExpr}`,
      `  billing_mode = "${e(billingMode)}"`,
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

    // Stream specification
    if (streamEnabled) {
      lines.push(`  stream_enabled   = true`);
      if (streamViewType) {
        lines.push(`  stream_view_type = "${e(streamViewType)}"`);
      }
    }

    // Collect all unique attribute definitions from hash_key, range_key, and GSI keys
    const attributeMap = new Map<string, string>();
    attributeMap.set(hashKey, hashKeyType);
    if (rangeKey) {
      attributeMap.set(rangeKey, rangeKeyType);
    }
    for (const gsi of gsis) {
      if (gsi.hash_key && !attributeMap.has(gsi.hash_key)) {
        attributeMap.set(gsi.hash_key, 'S');
      }
      if (gsi.range_key && !attributeMap.has(gsi.range_key)) {
        attributeMap.set(gsi.range_key, 'S');
      }
    }

    // Emit attribute blocks
    for (const [attrName, attrType] of attributeMap) {
      lines.push('');
      lines.push('  attribute {');
      lines.push(`    name = "${e(attrName)}"`);
      lines.push(`    type = "${e(attrType)}"`);
      lines.push('  }');
    }

    // Global Secondary Indexes
    for (const gsi of gsis) {
      lines.push('');
      lines.push('  global_secondary_index {');
      lines.push(`    name            = "${e(gsi.name)}"`);
      lines.push(`    hash_key        = "${e(gsi.hash_key)}"`);
      if (gsi.range_key) {
        lines.push(`    range_key       = "${e(gsi.range_key)}"`);
      }
      lines.push(`    projection_type = "${e(gsi.projection_type)}"`);
      if (billingMode === 'PROVISIONED') {
        const gsiRead = Number(gsi.read_capacity ?? 5);
        const gsiWrite = Number(gsi.write_capacity ?? 5);
        lines.push(`    read_capacity   = ${gsiRead}`);
        lines.push(`    write_capacity  = ${gsiWrite}`);
      }
      lines.push('  }');
    }

    if (pitr) {
      lines.push('');
      lines.push('  point_in_time_recovery {');
      lines.push('    enabled = true');
      lines.push('  }');
    }

    // TTL
    if (ttlEnabled && ttlAttributeName) {
      lines.push('');
      lines.push('  ttl {');
      lines.push(`    attribute_name = "${e(ttlAttributeName)}"`);
      lines.push('    enabled        = true');
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
