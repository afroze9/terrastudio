import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const ecsServiceHclGenerator: HclGenerator = {
  typeId: 'aws/containers/ecs_service',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const desiredCount = Number(props['desired_count'] ?? 1);
    const launchType = (props['launch_type'] as string) ?? 'FARGATE';
    const assignPublicIp = props['assign_public_ip'] as boolean ?? false;
    const healthCheckGrace = Number(props['health_check_grace_period'] ?? 60);

    const nameExpr = context.getPropertyExpression(resource, 'name', name);

    // Cluster reference from parent
    const clusterRef = resource.references?.['cluster'];
    const clusterIdExpr = clusterRef
      ? context.getAttributeReference(clusterRef, 'id')
      : '"CLUSTER_ID_PLACEHOLDER"';

    // Task definition reference
    const taskDefRef = resource.references?.['task_definition'];
    const taskDefArnExpr = taskDefRef
      ? context.getAttributeReference(taskDefRef, 'arn')
      : '"TASK_DEFINITION_ARN_PLACEHOLDER"';

    // Subnet IDs reference
    const subnetRef = resource.references?.['subnet_ids'];
    const subnetIdsExpr = subnetRef
      ? context.getAttributeReference(subnetRef, 'id')
      : '[]';

    const dependsOn: string[] = [];

    const lines: string[] = [
      `resource "aws_ecs_service" "${resource.terraformName}" {`,
      `  name            = ${nameExpr}`,
      `  cluster         = ${clusterIdExpr}`,
      `  task_definition = ${taskDefArnExpr}`,
      `  desired_count   = ${desiredCount}`,
      `  launch_type     = "${launchType}"`,
    ];

    if (healthCheckGrace > 0) {
      lines.push(`  health_check_grace_period_seconds = ${healthCheckGrace}`);
    }

    lines.push('');
    lines.push('  network_configuration {');
    lines.push(`    subnets          = ${subnetIdsExpr}`);
    lines.push(`    assign_public_ip = ${assignPublicIp}`);
    lines.push('  }');

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'aws_ecs_service',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
