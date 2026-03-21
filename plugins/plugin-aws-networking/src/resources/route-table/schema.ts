import type { ResourceSchema } from '@terrastudio/types';

export const routeTableSchema: ResourceSchema = {
  typeId: 'aws/networking/route_table',
  provider: 'aws',
  displayName: 'Route Table',
  category: 'aws-networking',
  description: 'AWS Route Table — custom routes to control VPC traffic flow',
  terraformType: 'aws_route_table',
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
      placeholder: 'my-rt',
      group: 'General',
      order: 1,
      validation: {
        minLength: 1,
        maxLength: 255,
      },
    },
    {
      key: 'routes',
      label: 'Routes',
      type: 'array',
      required: false,
      description: 'Routes to add to the route table',
      group: 'Routes',
      order: 2,
      itemSchema: {
        key: 'route',
        label: 'Route',
        type: 'object',
        required: true,
        nestedSchema: [
          {
            key: 'destination_cidr_block',
            label: 'Destination CIDR',
            type: 'cidr',
            required: true,
            placeholder: '10.0.0.0/16',
          },
          {
            key: 'target_type',
            label: 'Target Type',
            type: 'select',
            required: true,
            options: [
              { label: 'Internet Gateway', value: 'gateway' },
              { label: 'NAT Gateway', value: 'nat_gateway' },
              { label: 'Network Interface', value: 'network_interface' },
              { label: 'VPC Peering Connection', value: 'vpc_peering_connection' },
            ],
          },
          {
            key: 'target_id',
            label: 'Target ID',
            type: 'string',
            required: true,
            placeholder: 'ID of the target resource',
          },
        ],
      },
    },
  ],

  handles: [
    {
      id: 'rt-out',
      type: 'source',
      position: 'right',
      label: 'Route Table',
    },
    {
      id: 'subnet-in',
      type: 'target',
      position: 'left',
      label: 'Subnet',
      acceptsTypes: ['aws/networking/subnet'],
    },
  ],

  outputs: [
    { key: 'id', label: 'Route Table ID', terraformAttribute: 'id' },
    { key: 'arn', label: 'ARN', terraformAttribute: 'arn' },
  ],

  costEstimation: { serviceName: 'Amazon VPC', staticMonthlyCost: 0 },
};
