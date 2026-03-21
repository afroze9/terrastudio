import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const ecsServiceHclGenerator: HclGenerator = {
  typeId: 'aws/containers/ecs_service',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const desiredCount = Number(props['desired_count'] ?? 1);
    const launchType = (props['launch_type'] as string) ?? 'FARGATE';
    const assignPublicIp = props['assign_public_ip'] as boolean ?? false;
    const healthCheckGrace = Number(props['health_check_grace_period'] ?? 0);

    // Load balancer properties
    const lbTargetGroupArn = props['lb_target_group_arn'] as string | undefined;
    const lbContainerName = props['lb_container_name'] as string | undefined;
    const lbContainerPort = props['lb_container_port'] as number | undefined;

    // Network properties
    const subnetIds = props['subnet_ids'] as Array<Record<string, string>> | undefined;
    const securityGroupIds = props['security_group_ids'] as Array<Record<string, string>> | undefined;

    // Deployment properties
    const deployMinHealthy = Number(props['deployment_minimum_healthy_percent'] ?? 100);
    const deployMaxPercent = Number(props['deployment_maximum_percent'] ?? 200);

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

    const dependsOn: string[] = [];

    const lines: string[] = [
      `resource "aws_ecs_service" "${resource.terraformName}" {`,
      `  name            = ${nameExpr}`,
      `  cluster         = ${clusterIdExpr}`,
      `  task_definition = ${taskDefArnExpr}`,
      `  desired_count   = ${desiredCount}`,
      `  launch_type     = "${launchType}"`,
    ];

    if (healthCheckGrace > 0 || resource.variableOverrides?.['health_check_grace_period'] === 'variable') {
      const hcgExpr = context.getPropertyExpression(resource, 'health_check_grace_period', healthCheckGrace);
      lines.push(`  health_check_grace_period_seconds = ${hcgExpr}`);
    }

    // Load balancer block
    const hasLbArn = lbTargetGroupArn || resource.variableOverrides?.['lb_target_group_arn'] === 'variable';
    if (hasLbArn) {
      const arnExpr = context.getPropertyExpression(resource, 'lb_target_group_arn', lbTargetGroupArn ?? '');
      const containerNameExpr = context.getPropertyExpression(resource, 'lb_container_name', lbContainerName ?? '');
      const containerPortExpr = context.getPropertyExpression(resource, 'lb_container_port', lbContainerPort ?? 0);

      lines.push('');
      lines.push('  load_balancer {');
      lines.push(`    target_group_arn = ${arnExpr}`);
      lines.push(`    container_name   = ${containerNameExpr}`);
      lines.push(`    container_port   = ${containerPortExpr}`);
      lines.push('  }');
    }

    // Network configuration block
    const subnetIdsExpr = (() => {
      // Check for reference-based subnet IDs first
      const subnetRef = resource.references?.['subnet_ids'];
      if (subnetRef) {
        return context.getAttributeReference(subnetRef, 'id');
      }
      // Use property-based subnet IDs
      if (subnetIds && subnetIds.length > 0) {
        const ids = subnetIds.map((s) => s['id']).filter(Boolean);
        if (ids.length > 0) {
          return `[${ids.map((id) => `"${id}"`).join(', ')}]`;
        }
      }
      if (resource.variableOverrides?.['subnet_ids'] === 'variable') {
        return context.getPropertyExpression(resource, 'subnet_ids', []);
      }
      return '[]';
    })();

    const sgIdsExpr = (() => {
      if (securityGroupIds && securityGroupIds.length > 0) {
        const ids = securityGroupIds.map((s) => s['id']).filter(Boolean);
        if (ids.length > 0) {
          return `[${ids.map((id) => `"${id}"`).join(', ')}]`;
        }
      }
      if (resource.variableOverrides?.['security_group_ids'] === 'variable') {
        return context.getPropertyExpression(resource, 'security_group_ids', []);
      }
      return '[]';
    })();

    const assignPublicIpExpr = context.getPropertyExpression(resource, 'assign_public_ip', assignPublicIp);

    lines.push('');
    lines.push('  network_configuration {');
    lines.push(`    subnets          = ${subnetIdsExpr}`);
    lines.push(`    security_groups  = ${sgIdsExpr}`);
    lines.push(`    assign_public_ip = ${assignPublicIpExpr}`);
    lines.push('  }');

    // Deployment configuration block
    const hasNonDefaultDeployment =
      deployMinHealthy !== 100 ||
      deployMaxPercent !== 200 ||
      resource.variableOverrides?.['deployment_minimum_healthy_percent'] === 'variable' ||
      resource.variableOverrides?.['deployment_maximum_percent'] === 'variable';

    if (hasNonDefaultDeployment) {
      const minExpr = context.getPropertyExpression(resource, 'deployment_minimum_healthy_percent', deployMinHealthy);
      const maxExpr = context.getPropertyExpression(resource, 'deployment_maximum_percent', deployMaxPercent);

      lines.push('');
      lines.push('  deployment_configuration {');
      lines.push(`    minimum_healthy_percent = ${minExpr}`);
      lines.push(`    maximum_percent         = ${maxExpr}`);
      lines.push('  }');
    }

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
