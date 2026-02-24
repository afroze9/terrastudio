import type { ResourceSchema } from '@terrastudio/types';

export const natGatewaySchema: ResourceSchema = {
  typeId: 'azurerm/networking/nat_gateway',
  provider: 'azurerm',
  displayName: 'NAT Gateway',
  category: 'networking',
  description: 'Azure NAT Gateway — managed outbound SNAT for private subnets',
  terraformType: 'azurerm_nat_gateway',
  supportsTags: true,
  requiresResourceGroup: true,
  cafAbbreviation: 'ng',
  namingConstraints: { maxLength: 80 },

  canBeChildOf: [
    'azurerm/core/resource_group',
  ],

  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'ng-myapp-dev',
      group: 'General',
      order: 1,
      validation: {
        minLength: 1,
        maxLength: 80,
        pattern: '^[a-zA-Z0-9][a-zA-Z0-9_.-]*[a-zA-Z0-9_]$',
        patternMessage: 'Must start with alphanumeric, end with alphanumeric or underscore',
      },
    },
    {
      key: 'idle_timeout_in_minutes',
      label: 'Idle Timeout (min)',
      type: 'number',
      required: false,
      group: 'General',
      order: 2,
      defaultValue: 4,
      description: 'TCP idle connection timeout in minutes',
      validation: { min: 4, max: 120 },
    },
    {
      key: 'pip_enabled',
      label: 'Public IP',
      type: 'boolean',
      required: false,
      group: 'Public IP',
      order: 10,
      defaultValue: false,
      description: 'Associate a Public IP address for outbound internet traffic',
    },
    {
      key: 'pip_id',
      label: 'Public IP',
      type: 'reference',
      required: false,
      group: 'Public IP',
      order: 11,
      referenceTargetTypes: ['azurerm/networking/public_ip'],
      visibleWhen: { field: 'pip_enabled', operator: 'truthy' },
    },
  ],

  handles: [],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
  ],
};
