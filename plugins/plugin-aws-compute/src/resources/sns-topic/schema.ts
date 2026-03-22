import type { ResourceSchema } from '@terrastudio/types';

export const snsTopicSchema: ResourceSchema = {
  typeId: 'aws/messaging/sns_topic',
  provider: 'aws',
  displayName: 'SNS Topic',
  category: 'aws-messaging',
  description: 'AWS SNS topic for pub/sub notifications and fan-out messaging',
  terraformType: 'aws_sns_topic',
  supportsTags: true,
  requiresResourceGroup: false,

  properties: [
    {
      key: 'name',
      label: 'Topic Name',
      type: 'string',
      required: true,
      placeholder: 'order-events',
      group: 'General',
      order: 1,
    },
    {
      key: 'fifo_topic',
      label: 'FIFO Topic',
      type: 'boolean',
      required: false,
      defaultValue: false,
      group: 'General',
      order: 2,
      description: 'First-In-First-Out delivery. Name must end with .fifo',
    },
    {
      key: 'display_name',
      label: 'Display Name',
      type: 'string',
      required: false,
      placeholder: 'Order Events',
      group: 'General',
      order: 3,
      description: 'Human-readable name used in SMS and email "From" field',
    },
    {
      key: 'kms_master_key_id',
      label: 'KMS Key ID',
      type: 'string',
      required: false,
      placeholder: 'alias/aws/sns',
      group: 'Encryption',
      order: 4,
      description: 'KMS key for at-rest encryption',
    },
  ],

  handles: [
    { id: 'sns-in', type: 'target', position: 'left', label: 'Publisher' },
    { id: 'sns-out', type: 'source', position: 'right', label: 'Subscribers' },
  ],

  outputs: [
    { key: 'id', label: 'Topic ID', terraformAttribute: 'id' },
    { key: 'arn', label: 'ARN', terraformAttribute: 'arn' },
  ],

  costEstimation: {
    serviceName: 'SNS',
    usageInputs: [
      {
        key: '_cost_requests_millions',
        label: 'Monthly Publishes',
        unit: 'million',
        defaultValue: 1,
        min: 0,
        max: 1000000,
        description: '~$0.50/million publishes. First 1M free. HTTP deliveries ~$0.60/million.',
      },
    ],
  },
};
