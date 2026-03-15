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
    const containerPort = Number(props['container_port'] ?? 80);
    const launchType = (props['requires_compatibilities'] as string) ?? 'FARGATE';

    const familyExpr = context.getPropertyExpression(resource, 'family', family);

    // Execution role reference
    const roleRef = resource.references?.['execution_role_arn'];
    const roleArnExpr = roleRef
      ? context.getAttributeReference(roleRef, 'arn')
      : '"EXECUTION_ROLE_ARN_PLACEHOLDER"';

    const lines: string[] = [
      `resource "aws_ecs_task_definition" "${resource.terraformName}" {`,
      `  family                   = ${familyExpr}`,
      `  requires_compatibilities = ["${launchType}"]`,
      `  network_mode             = "${networkMode}"`,
      `  cpu                      = "${cpu}"`,
      `  memory                   = "${memory}"`,
      `  execution_role_arn       = ${roleArnExpr}`,
      '',
      '  container_definitions = jsonencode([',
      '    {',
      `      name      = ${familyExpr}`,
      `      image     = "${containerImage}"`,
      `      cpu       = ${cpu}`,
      `      memory    = ${memory}`,
      '      essential = true',
      '',
      '      portMappings = [',
      '        {',
      `          containerPort = ${containerPort}`,
      `          hostPort      = ${containerPort}`,
      '        }',
      '      ]',
      '    }',
      '  ])',
      '',
      '  tags = local.common_tags',
      '}',
    ];

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
