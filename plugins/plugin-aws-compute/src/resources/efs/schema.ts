import type { ResourceSchema } from '@terrastudio/types';

export const efsSchema: ResourceSchema = {
  typeId: 'aws/storage/efs',
  provider: 'aws',
  displayName: 'EFS File System',
  category: 'aws-storage',
  description: 'Amazon Elastic File System — fully managed NFS file storage',
  terraformType: 'aws_efs_file_system',
  supportsTags: true,
  requiresResourceGroup: false,

  properties: [
    {
      key: 'name',
      label: 'File System Name',
      type: 'string',
      required: true,
      placeholder: 'my-efs',
      group: 'General',
      order: 1,
    },
    {
      key: 'performance_mode',
      label: 'Performance Mode',
      type: 'select',
      required: false,
      defaultValue: 'generalPurpose',
      options: [
        { label: 'General Purpose', value: 'generalPurpose' },
        { label: 'Max I/O', value: 'maxIO' },
      ],
      group: 'Performance',
      order: 2,
    },
    {
      key: 'throughput_mode',
      label: 'Throughput Mode',
      type: 'select',
      required: false,
      defaultValue: 'bursting',
      options: [
        { label: 'Bursting', value: 'bursting' },
        { label: 'Elastic', value: 'elastic' },
        { label: 'Provisioned', value: 'provisioned' },
      ],
      group: 'Performance',
      order: 3,
    },
    {
      key: 'provisioned_throughput_in_mibps',
      label: 'Provisioned Throughput (MiB/s)',
      type: 'number',
      required: false,
      group: 'Performance',
      order: 4,
      visibleWhen: { field: 'throughput_mode', operator: 'eq', value: 'provisioned' },
    },
    {
      key: 'encrypted',
      label: 'Encrypted',
      type: 'boolean',
      required: false,
      defaultValue: true,
      group: 'Security',
      order: 5,
    },
    {
      key: 'lifecycle_policy',
      label: 'Transition to IA after',
      type: 'select',
      required: false,
      defaultValue: 'AFTER_30_DAYS',
      options: [
        { label: 'Never', value: '' },
        { label: '7 days', value: 'AFTER_7_DAYS' },
        { label: '14 days', value: 'AFTER_14_DAYS' },
        { label: '30 days', value: 'AFTER_30_DAYS' },
        { label: '60 days', value: 'AFTER_60_DAYS' },
        { label: '90 days', value: 'AFTER_90_DAYS' },
      ],
      group: 'Lifecycle',
      order: 5,
      description: 'Move files to Infrequent Access storage after inactivity',
    },
  ],

  handles: [
    { id: 'efs-in', type: 'target', position: 'left', label: 'Mount' },
    { id: 'efs-out', type: 'source', position: 'right', label: 'Consumer' },
  ],

  outputs: [
    { key: 'id', label: 'File System ID', terraformAttribute: 'id' },
    { key: 'arn', label: 'ARN', terraformAttribute: 'arn' },
    { key: 'dns_name', label: 'DNS Name', terraformAttribute: 'dns_name' },
  ],

  costEstimation: {
    serviceName: 'EFS',
    usageInputs: [
      {
        key: '_cost_storage_gb',
        label: 'Storage (GB)',
        unit: 'GB',
        defaultValue: 50,
        min: 0,
        max: 100000,
        description: '$0.30/GB/month for Standard. $0.025/GB/month for IA.',
      },
    ],
  },
};
