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
