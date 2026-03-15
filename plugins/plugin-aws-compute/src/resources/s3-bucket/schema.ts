import type { ResourceSchema } from '@terrastudio/types';

export const s3BucketSchema: ResourceSchema = {
  typeId: 'aws/storage/s3_bucket',
  provider: 'aws',
  displayName: 'S3 Bucket',
  category: 'aws-storage',
  description: 'AWS S3 object storage bucket',
  terraformType: 'aws_s3_bucket',
  supportsTags: true,
  requiresResourceGroup: false,

  properties: [
    {
      key: 'name',
      label: 'Bucket Name',
      type: 'string',
      required: true,
      placeholder: 'my-app-bucket',
      group: 'General',
      order: 1,
      validation: {
        minLength: 3,
        maxLength: 63,
        pattern: '^[a-z0-9][a-z0-9.-]*[a-z0-9]$',
        patternMessage: 'Lowercase letters, numbers, hyphens, and dots. Must start and end with letter or number.',
      },
    },
    {
      key: 'force_destroy',
      label: 'Force Destroy',
      type: 'boolean',
      required: false,
      defaultValue: false,
      group: 'General',
      order: 2,
      description: 'Allow Terraform to destroy the bucket even if it contains objects',
    },
    {
      key: 'versioning_enabled',
      label: 'Versioning',
      type: 'boolean',
      required: false,
      defaultValue: false,
      group: 'Settings',
      order: 3,
      description: 'Enable object versioning',
    },
    {
      key: 'acl',
      label: 'ACL',
      type: 'select',
      required: false,
      defaultValue: 'private',
      group: 'Settings',
      order: 4,
      options: [
        { label: 'Private', value: 'private' },
        { label: 'Public Read', value: 'public-read' },
        { label: 'Public Read/Write', value: 'public-read-write' },
        { label: 'Authenticated Read', value: 'authenticated-read' },
      ],
    },
    {
      key: 'encryption',
      label: 'Encryption',
      type: 'select',
      required: false,
      defaultValue: 'AES256',
      group: 'Security',
      order: 5,
      options: [
        { label: 'SSE-S3 (AES256)', value: 'AES256' },
        { label: 'SSE-KMS', value: 'aws:kms' },
      ],
    },
  ],

  handles: [],

  outputs: [
    { key: 'id', label: 'Bucket ID', terraformAttribute: 'id' },
    { key: 'arn', label: 'ARN', terraformAttribute: 'arn' },
    { key: 'bucket_domain_name', label: 'Domain Name', terraformAttribute: 'bucket_domain_name' },
    { key: 'bucket_regional_domain_name', label: 'Regional Domain', terraformAttribute: 'bucket_regional_domain_name' },
  ],

  costEstimation: {
    serviceName: 'S3',
    usageInputs: [
      {
        key: '_cost_storage_gb',
        label: 'Estimated Storage',
        unit: 'GB',
        defaultValue: 100,
        min: 0,
        max: 1000000,
        description: 'Total data stored in the bucket (~$0.023/GB for Standard)',
      },
    ],
  },
};
