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
