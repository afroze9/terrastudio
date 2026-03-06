import type { ResourceSchema } from '@terrastudio/types';

export const cloudwatchLogGroupSchema: ResourceSchema = {
  typeId: 'aws/monitoring/cloudwatch_log_group',
  provider: 'aws',
  displayName: 'CloudWatch Log Group',
  category: 'aws-monitoring',
  description: 'AWS CloudWatch Log Group for centralized logging',
  terraformType: 'aws_cloudwatch_log_group',
  supportsTags: true,
  requiresResourceGroup: false,

  properties: [
    {
      key: 'name',
      label: 'Log Group Name',
      type: 'string',
      required: true,
      placeholder: '/aws/lambda/my-function',
      group: 'General',
      order: 1,
      validation: { maxLength: 512 },
    },
    {
      key: 'retention_in_days',
      label: 'Retention',
      type: 'select',
      required: false,
      defaultValue: '14',
      group: 'General',
      order: 2,
      description: 'Log retention period',
      options: [
        { label: '1 day', value: '1' },
        { label: '3 days', value: '3' },
        { label: '7 days', value: '7' },
        { label: '14 days', value: '14' },
        { label: '30 days', value: '30' },
        { label: '60 days', value: '60' },
        { label: '90 days', value: '90' },
        { label: '180 days', value: '180' },
        { label: '365 days', value: '365' },
        { label: 'Never expire', value: '0' },
      ],
    },
  ],

  handles: [],

  outputs: [
    { key: 'arn', label: 'ARN', terraformAttribute: 'arn' },
    { key: 'name', label: 'Name', terraformAttribute: 'name' },
  ],

  costEstimation: {
    serviceName: 'CloudWatch Logs',
    usageInputs: [
      {
        key: '_cost_ingestion_gb',
        label: 'Log Ingestion',
        unit: 'GB/mo',
        defaultValue: 5,
        min: 0,
        max: 100000,
        description: 'Monthly log data ingested (~$0.50/GB)',
      },
      {
        key: '_cost_storage_gb',
        label: 'Log Storage',
        unit: 'GB',
        defaultValue: 10,
        min: 0,
        max: 1000000,
        description: 'Total log data stored (~$0.03/GB/month)',
      },
    ],
  },
};
