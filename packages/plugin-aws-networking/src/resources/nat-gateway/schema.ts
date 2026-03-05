import type { ResourceSchema } from '@terrastudio/types';

export const natGatewaySchema: ResourceSchema = {
  typeId: 'aws/networking/nat_gateway',
  provider: 'aws',
  displayName: 'NAT Gateway',
  category: 'aws-networking',
  description: 'AWS NAT Gateway — managed outbound internet access for private subnets',
  terraformType: 'aws_nat_gateway',
  supportsTags: true,
  requiresResourceGroup: false,
  canBeChildOf: [
    'aws/networking/subnet',
  ],
  parentReference: { propertyKey: 'subnet_id' },

  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'my-natgw',
      group: 'General',
      order: 1,
      validation: {
        minLength: 1,
        maxLength: 255,
      },
    },
    {
      key: 'connectivity_type',
      label: 'Connectivity Type',
      type: 'select',
      required: false,
      group: 'General',
      order: 2,
      defaultValue: 'public',
      description: 'Connectivity type for the NAT Gateway',
      options: [
        { label: 'Public', value: 'public' },
        { label: 'Private', value: 'private' },
      ],
    },
    {
      key: 'allocation_id_enabled',
      label: 'Elastic IP',
      type: 'boolean',
      required: false,
      group: 'Elastic IP',
      order: 10,
      defaultValue: false,
      description: 'Associate an Elastic IP address (required for public NAT Gateway)',
      visibleWhen: { field: 'connectivity_type', operator: 'eq', value: 'public' },
    },
    {
      key: 'allocation_id',
      label: 'Elastic IP',
      type: 'reference',
      required: false,
      group: 'Elastic IP',
      order: 11,
      referenceTargetTypes: ['aws/compute/eip'],
      visibleWhen: { field: 'allocation_id_enabled', operator: 'truthy' },
    },
  ],

  handles: [
    {
      id: 'natgw-out',
      type: 'source',
      position: 'right',
      label: 'NAT Gateway',
    },
  ],

  outputs: [
    { key: 'id', label: 'NAT Gateway ID', terraformAttribute: 'id' },
    { key: 'allocation_id', label: 'Allocation ID', terraformAttribute: 'allocation_id' },
    { key: 'public_ip', label: 'Public IP', terraformAttribute: 'public_ip' },
  ],
};
