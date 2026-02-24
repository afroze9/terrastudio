import type { ResourceSchema } from '@terrastudio/types';

export const routeSchema: ResourceSchema = {
  typeId: 'azurerm/networking/route',
  provider: 'azurerm',
  displayName: 'Route',
  category: 'networking',
  description: 'Custom route entry within an Azure Route Table',
  terraformType: 'azurerm_route',
  supportsTags: false,
  requiresResourceGroup: true,

  canBeChildOf: [
    'azurerm/networking/route_table',
  ],

  parentReference: { propertyKey: 'route_table_name' },

  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'route-to-internet',
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
      key: 'address_prefix',
      label: 'Address Prefix',
      type: 'cidr',
      required: true,
      group: 'General',
      order: 2,
      placeholder: '0.0.0.0/0',
      description: 'Destination CIDR for this route',
    },
    {
      key: 'next_hop_type',
      label: 'Next Hop Type',
      type: 'select',
      required: true,
      group: 'General',
      order: 3,
      defaultValue: 'Internet',
      options: [
        { label: 'Internet', value: 'Internet' },
        { label: 'Virtual Network (local)', value: 'VnetLocal' },
        { label: 'Virtual Network Gateway', value: 'VirtualNetworkGateway' },
        { label: 'Virtual Appliance (NVA)', value: 'VirtualAppliance' },
        { label: 'None (black hole)', value: 'None' },
      ],
    },
    {
      key: 'next_hop_in_ip_address',
      label: 'Next Hop IP Address',
      type: 'string',
      required: false,
      group: 'General',
      order: 4,
      placeholder: '10.0.1.4',
      description: 'IP address of the next hop (required when Next Hop Type is Virtual Appliance)',
      visibleWhen: { field: 'next_hop_type', operator: 'eq', value: 'VirtualAppliance' },
    },
  ],

  handles: [],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
  ],
};
