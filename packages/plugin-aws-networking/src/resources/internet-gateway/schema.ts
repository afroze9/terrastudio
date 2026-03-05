import type { ResourceSchema } from '@terrastudio/types';

export const internetGatewaySchema: ResourceSchema = {
  typeId: 'aws/networking/internet_gateway',
  provider: 'aws',
  displayName: 'Internet Gateway',
  category: 'aws-networking',
  description: 'AWS Internet Gateway — enables internet access for VPC resources',
  terraformType: 'aws_internet_gateway',
  supportsTags: true,
  requiresResourceGroup: false,
  canBeChildOf: [
    'aws/networking/vpc',
  ],
  parentReference: { propertyKey: 'vpc_id' },

  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'my-igw',
      group: 'General',
      order: 1,
      validation: {
        minLength: 1,
        maxLength: 255,
      },
    },
  ],

  handles: [
    {
      id: 'igw-out',
      type: 'source',
      position: 'right',
      label: 'Gateway',
    },
  ],

  outputs: [
    { key: 'id', label: 'Gateway ID', terraformAttribute: 'id' },
    { key: 'arn', label: 'ARN', terraformAttribute: 'arn' },
  ],
};
