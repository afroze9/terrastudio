import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const ecsClusterHclGenerator: HclGenerator = {
  typeId: 'aws/containers/ecs_cluster',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const containerInsights = props['container_insights'] as boolean ?? true;
    const capacityProvider = props['capacity_provider'] as string ?? 'FARGATE';

    const nameExpr = context.getPropertyExpression(resource, 'name', name);

    const lines: string[] = [
      `resource "aws_ecs_cluster" "${resource.terraformName}" {`,
      `  name = ${nameExpr}`,
    ];

    if (containerInsights) {
      lines.push('');
      lines.push('  setting {');
      lines.push('    name  = "containerInsights"');
      lines.push('    value = "enabled"');
      lines.push('  }');
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    const blocks: HclBlock[] = [
      {
        blockType: 'resource',
        terraformType: 'aws_ecs_cluster',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];

    // Add capacity provider strategy
    const cpLines: string[] = [
      `resource "aws_ecs_cluster_capacity_providers" "${resource.terraformName}" {`,
      `  cluster_name = aws_ecs_cluster.${resource.terraformName}.name`,
      '',
      `  capacity_providers = ["${capacityProvider}"]`,
      '',
      '  default_capacity_provider_strategy {',
      `    base              = 1`,
      `    weight            = 100`,
      `    capacity_provider = "${capacityProvider}"`,
      '  }',
      '}',
    ];

    blocks.push({
      blockType: 'resource',
      terraformType: 'aws_ecs_cluster_capacity_providers',
      name: resource.terraformName,
      content: cpLines.join('\n'),
    });

    return blocks;
  },
};
