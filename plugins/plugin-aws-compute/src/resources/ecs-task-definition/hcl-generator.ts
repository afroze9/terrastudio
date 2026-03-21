import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const ecsTaskDefinitionHclGenerator: HclGenerator = {
  typeId: 'aws/containers/ecs_task_definition',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const family = props['family'] as string;
    const cpu = (props['cpu'] as string) ?? '256';
    const memory = (props['memory'] as string) ?? '512';
    const networkMode = (props['network_mode'] as string) ?? 'awsvpc';
    const containerImage = (props['container_image'] as string) ?? 'nginx:latest';
    const containerName = (props['container_name'] as string) ?? 'app';
    const containerPort = Number(props['container_port'] ?? 80);
    const containerMemory = props['container_memory'] as number | undefined;
    const containerCpu = props['container_cpu'] as number | undefined;
    const essential = props['essential'] as boolean ?? true;
    const launchType = (props['requires_compatibilities'] as string) ?? 'FARGATE';
    const envVars = props['environment_variables'] as Record<string, string> | undefined;
    const executionRoleArn = props['execution_role_arn'] as string | undefined;
    const taskRoleArn = props['task_role_arn'] as string | undefined;

    const familyExpr = context.getPropertyExpression(resource, 'family', family);

    // Execution role: prefer reference, then property, then placeholder
    const roleRef = resource.references?.['execution_role_arn'];
    let roleArnExpr: string;
    if (roleRef) {
      roleArnExpr = context.getAttributeReference(roleRef, 'arn');
    } else if (executionRoleArn || resource.variableOverrides?.['execution_role_arn'] === 'variable') {
      roleArnExpr = context.getPropertyExpression(resource, 'execution_role_arn', executionRoleArn ?? '');
    } else {
      roleArnExpr = '';
    }

    const lines: string[] = [
      `resource "aws_ecs_task_definition" "${resource.terraformName}" {`,
      `  family                   = ${familyExpr}`,
      `  requires_compatibilities = ["${launchType}"]`,
      `  network_mode             = "${networkMode}"`,
      `  cpu                      = "${cpu}"`,
      `  memory                   = "${memory}"`,
    ];

    if (roleArnExpr) {
      lines.push(`  execution_role_arn       = ${roleArnExpr}`);
    }

    // Task role ARN
    if (taskRoleArn || resource.variableOverrides?.['task_role_arn'] === 'variable') {
      const taskRoleExpr = context.getPropertyExpression(resource, 'task_role_arn', taskRoleArn ?? '');
      lines.push(`  task_role_arn            = ${taskRoleExpr}`);
    }

    // Build container definition object
    const containerLines: string[] = [];
    containerLines.push('    {');
    containerLines.push(`      name      = "${containerName}"`);
    containerLines.push(`      image     = "${containerImage}"`);
    containerLines.push(`      essential = ${essential}`);

    if (containerCpu != null) {
      containerLines.push(`      cpu       = ${containerCpu}`);
    } else {
      containerLines.push(`      cpu       = ${cpu}`);
    }

    if (containerMemory != null) {
      containerLines.push(`      memory    = ${containerMemory}`);
    } else {
      containerLines.push(`      memory    = ${memory}`);
    }

    // Port mappings
    containerLines.push('');
    containerLines.push('      portMappings = [');
    containerLines.push('        {');
    containerLines.push(`          containerPort = ${containerPort}`);
    containerLines.push(`          hostPort      = ${containerPort}`);
    containerLines.push('        }');
    containerLines.push('      ]');

    // Environment variables
    if (envVars && Object.keys(envVars).length > 0) {
      containerLines.push('');
      containerLines.push('      environment = [');
      for (const [k, v] of Object.entries(envVars)) {
        containerLines.push('        {');
        containerLines.push(`          name  = "${k}"`);
        containerLines.push(`          value = "${v}"`);
        containerLines.push('        },');
      }
      containerLines.push('      ]');
    }

    containerLines.push('    }');

    lines.push('');
    lines.push('  container_definitions = jsonencode([');
    lines.push(...containerLines);
    lines.push('  ])');

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'aws_ecs_task_definition',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
