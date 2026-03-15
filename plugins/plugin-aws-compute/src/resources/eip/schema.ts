import type { ResourceSchema } from '@terrastudio/types';

export const eipSchema: ResourceSchema = {
  typeId: 'aws/compute/eip',
  provider: 'aws',
  displayName: 'Elastic IP',
  category: 'aws-compute',
  description: 'AWS Elastic IP address for static public IPs',
  terraformType: 'aws_eip',
  supportsTags: true,
  requiresResourceGroup: false,
  canBeChildOf: ['aws/networking/vpc'],

  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'web-eip',
      group: 'General',
      order: 1,
    },
    {
      key: 'domain',
      label: 'Domain',
      type: 'select',
      required: true,
      defaultValue: 'vpc',
      group: 'General',
      order: 2,
      options: [
        { label: 'VPC', value: 'vpc' },
      ],
    },
  ],

  handles: [
    { id: 'eip-out', type: 'source', position: 'right', label: 'Elastic IP' },
    { id: 'ec2-in', type: 'target', position: 'left', label: 'EC2 Instance', acceptsTypes: ['aws/compute/instance'] },
  ],

  outputs: [
    { key: 'id', label: 'EIP ID', terraformAttribute: 'id' },
    { key: 'public_ip', label: 'Public IP', terraformAttribute: 'public_ip' },
    { key: 'allocation_id', label: 'Allocation ID', terraformAttribute: 'allocation_id' },
  ],

  costEstimation: {
    serviceName: 'EC2',
    staticMonthlyCost: 3.65,
  },
};
