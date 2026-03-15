import type { ResourceSchema } from '@terrastudio/types';

export const secretsManagerSchema: ResourceSchema = {
  typeId: 'aws/security/secrets_manager',
  provider: 'aws',
  displayName: 'Secrets Manager',
  category: 'aws-security',
  description: 'AWS Secrets Manager for storing and rotating secrets',
  terraformType: 'aws_secretsmanager_secret',
  supportsTags: true,
  requiresResourceGroup: false,

  properties: [
    {
      key: 'name',
      label: 'Secret Name',
      type: 'string',
      required: true,
      placeholder: 'my-app/db-password',
      group: 'General',
      order: 1,
    },
    {
      key: 'description',
      label: 'Description',
      type: 'string',
      required: false,
      placeholder: 'Database credentials for my-app',
      group: 'General',
      order: 2,
    },
    {
      key: 'recovery_window_in_days',
      label: 'Recovery Window (days)',
      type: 'number',
      required: false,
      defaultValue: 30,
      group: 'General',
      order: 3,
      description: 'Days before permanent deletion (0 = immediate, 7-30)',
      validation: { min: 0, max: 30 },
    },
    {
      key: 'kms_key_id',
      label: 'KMS Key ID',
      type: 'string',
      required: false,
      placeholder: 'alias/aws/secretsmanager',
      group: 'Encryption',
      order: 4,
      description: 'Custom KMS key for encryption (leave empty for default)',
    },
  ],

  handles: [
    { id: 'secret-in', type: 'target', position: 'left', label: 'Writer' },
    { id: 'secret-out', type: 'source', position: 'right', label: 'Reader' },
  ],

  outputs: [
    { key: 'id', label: 'Secret ID', terraformAttribute: 'id' },
    { key: 'arn', label: 'ARN', terraformAttribute: 'arn' },
  ],

  costEstimation: {
    serviceName: 'Secrets Manager',
    usageInputs: [
      {
        key: '_cost_secrets',
        label: 'Number of Secrets',
        unit: 'secrets',
        defaultValue: 1,
        min: 1,
        max: 10000,
        description: '$0.40/secret/month. $0.05 per 10K API calls.',
      },
    ],
  },
};
