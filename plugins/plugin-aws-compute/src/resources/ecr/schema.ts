import type { ResourceSchema } from '@terrastudio/types';

export const ecrSchema: ResourceSchema = {
  typeId: 'aws/containers/ecr',
  provider: 'aws',
  displayName: 'ECR Repository',
  category: 'aws-containers',
  description: 'Amazon Elastic Container Registry for Docker images',
  terraformType: 'aws_ecr_repository',
  supportsTags: true,
  requiresResourceGroup: false,

  properties: [
    {
      key: 'name',
      label: 'Repository Name',
      type: 'string',
      required: true,
      placeholder: 'my-app',
      group: 'General',
      order: 1,
    },
    {
      key: 'image_tag_mutability',
      label: 'Image Tag Mutability',
      type: 'select',
      required: false,
      defaultValue: 'MUTABLE',
      options: [
        { label: 'Mutable', value: 'MUTABLE' },
        { label: 'Immutable', value: 'IMMUTABLE' },
      ],
      group: 'General',
      order: 2,
      description: 'Immutable tags prevent overwriting existing image tags',
    },
    {
      key: 'scan_on_push',
      label: 'Scan on Push',
      type: 'boolean',
      required: false,
      defaultValue: true,
      group: 'Security',
      order: 3,
      description: 'Automatically scan images for vulnerabilities on push',
    },
    {
      key: 'encryption_type',
      label: 'Encryption Type',
      type: 'select',
      required: false,
      defaultValue: 'AES256',
      options: [
        { label: 'AES-256 (default)', value: 'AES256' },
        { label: 'KMS', value: 'KMS' },
      ],
      group: 'Security',
      order: 4,
    },
    {
      key: 'force_delete',
      label: 'Force Delete',
      type: 'boolean',
      required: false,
      defaultValue: false,
      group: 'General',
      order: 5,
      description: 'Delete repository even if it contains images',
    },
  ],

  handles: [
    { id: 'ecr-out', type: 'source', position: 'right', label: 'Image Consumer' },
  ],

  outputs: [
    { key: 'id', label: 'Repository ID', terraformAttribute: 'id' },
    { key: 'arn', label: 'ARN', terraformAttribute: 'arn' },
    { key: 'repository_url', label: 'Repository URL', terraformAttribute: 'repository_url' },
  ],

  costEstimation: {
    serviceName: 'ECR',
    usageInputs: [
      {
        key: '_cost_storage_gb',
        label: 'Storage (GB)',
        unit: 'GB',
        defaultValue: 5,
        min: 0,
        max: 10000,
        description: '$0.10/GB/month for private repos. First 500 MB free for public.',
      },
    ],
  },
};
