import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const sqsQueueHclGenerator: HclGenerator = {
  typeId: 'aws/messaging/sqs_queue',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const fifo = props['fifo_queue'] as boolean ?? false;
    const visibilityTimeout = Number(props['visibility_timeout_seconds'] ?? 30);
    const messageRetention = Number(props['message_retention_seconds'] ?? 345600);
    const delaySeconds = Number(props['delay_seconds'] ?? 0);
    const maxMessageSize = Number(props['max_message_size'] ?? 262144);

    const nameExpr = context.getPropertyExpression(resource, 'name', name);

    const lines: string[] = [
      `resource "aws_sqs_queue" "${resource.terraformName}" {`,
      `  name                       = ${nameExpr}`,
    ];

    if (fifo) {
      lines.push('  fifo_queue                  = true');
      lines.push('  content_based_deduplication = true');
    }

    lines.push(`  visibility_timeout_seconds  = ${visibilityTimeout}`);
    lines.push(`  message_retention_seconds   = ${messageRetention}`);
    lines.push(`  delay_seconds              = ${delaySeconds}`);
    lines.push(`  max_message_size           = ${maxMessageSize}`);

    const receiveWaitTime = Number(props['receive_wait_time_seconds'] ?? 0);
    const receiveWaitIsVar = resource.variableOverrides?.['receive_wait_time_seconds'] === 'variable';
    if (receiveWaitIsVar || receiveWaitTime !== 0) {
      const receiveWaitExpr = context.getPropertyExpression(resource, 'receive_wait_time_seconds', receiveWaitTime);
      lines.push(`  receive_wait_time_seconds  = ${receiveWaitExpr}`);
    }

    const redriveEnabled = props['redrive_policy_enabled'] as boolean ?? false;
    if (redriveEnabled) {
      const dlqArn = props['dead_letter_target_arn'] as string ?? '';
      const maxReceiveCount = Number(props['max_receive_count'] ?? 5);
      const dlqArnExpr = context.getPropertyExpression(resource, 'dead_letter_target_arn', dlqArn);
      const maxReceiveExpr = context.getPropertyExpression(resource, 'max_receive_count', maxReceiveCount);
      lines.push('');
      lines.push(`  redrive_policy = jsonencode({`);
      lines.push(`    deadLetterTargetArn = ${dlqArnExpr}`);
      lines.push(`    maxReceiveCount     = ${maxReceiveExpr}`);
      lines.push(`  })`);
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'aws_sqs_queue',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
