import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const elasticacheHclGenerator: HclGenerator = {
  typeId: 'aws/database/elasticache',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const clusterId = props['cluster_id'] as string;
    const engine = props['engine'] as string ?? 'redis';
    const nodeType = props['node_type'] as string ?? 'cache.t3.micro';
    const numNodes = props['num_cache_nodes'] as number ?? 1;
    const engineVersion = props['engine_version'] as string | undefined;
    const port = props['port'] as number | undefined;
    const subnetGroupName = props['subnet_group_name'] as string | undefined;
    const securityGroupIds = props['security_group_ids'] as string[] | undefined;
    const parameterGroupName = props['parameter_group_name'] as string | undefined;
    const azMode = props['az_mode'] as string | undefined;
    const notificationTopicArn = props['notification_topic_arn'] as string | undefined;

    const clusterIdExpr = context.getPropertyExpression(resource, 'cluster_id', clusterId);
    const nodeTypeExpr = context.getPropertyExpression(resource, 'node_type', nodeType);

    const lines: string[] = [
      `resource "aws_elasticache_cluster" "${resource.terraformName}" {`,
      `  cluster_id      = ${clusterIdExpr}`,
      `  engine          = "${engine}"`,
      `  node_type       = ${nodeTypeExpr}`,
      `  num_cache_nodes = ${numNodes}`,
    ];

    if (engineVersion || resource.variableOverrides?.['engine_version'] === 'variable') {
      const versionExpr = context.getPropertyExpression(resource, 'engine_version', engineVersion ?? '');
      lines.push(`  engine_version  = ${versionExpr}`);
    }

    if (port) {
      lines.push(`  port = ${port}`);
    }

    if (subnetGroupName || resource.variableOverrides?.['subnet_group_name'] === 'variable') {
      const expr = context.getPropertyExpression(resource, 'subnet_group_name', subnetGroupName ?? '');
      lines.push(`  subnet_group_name = ${expr}`);
    }

    if ((securityGroupIds && securityGroupIds.length > 0) || resource.variableOverrides?.['security_group_ids'] === 'variable') {
      const expr = context.getPropertyExpression(resource, 'security_group_ids', securityGroupIds ?? []);
      lines.push(`  security_group_ids = ${expr}`);
    }

    if (parameterGroupName || resource.variableOverrides?.['parameter_group_name'] === 'variable') {
      const expr = context.getPropertyExpression(resource, 'parameter_group_name', parameterGroupName ?? '');
      lines.push(`  parameter_group_name = ${expr}`);
    }

    if (azMode || resource.variableOverrides?.['az_mode'] === 'variable') {
      const expr = context.getPropertyExpression(resource, 'az_mode', azMode ?? 'single-az');
      lines.push(`  az_mode = ${expr}`);
    }

    if (notificationTopicArn || resource.variableOverrides?.['notification_topic_arn'] === 'variable') {
      const expr = context.getPropertyExpression(resource, 'notification_topic_arn', notificationTopicArn ?? '');
      lines.push(`  notification_topic_arn = ${expr}`);
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'aws_elasticache_cluster',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
