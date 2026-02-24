import type { ResourceSchema } from '@terrastudio/types';

export const routeTableSchema: ResourceSchema = {
  typeId: 'azurerm/networking/route_table',
  provider: 'azurerm',
  displayName: 'Route Table',
  category: 'networking',
  description: 'Azure Route Table (UDR) — custom routes to control subnet traffic flow',
  terraformType: 'azurerm_route_table',
  supportsTags: true,
  requiresResourceGroup: true,
  cafAbbreviation: 'rt',
  namingConstraints: { maxLength: 80 },
  isContainer: true,

  canBeChildOf: [
    'azurerm/core/resource_group',
  ],

  containerStyle: {
    borderColor: '#2B7CF6',
    borderStyle: 'dotted',
    backgroundColor: '#ffffff',
    headerColor: '#1a1a2e',
    borderRadius: 12,
    borderWidth: 3,
    hideHeaderBorder: true,
    iconSize: 28,
    labelSize: 16,
    dashArray: '4,8',
  },

  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'rt-myapp-dev',
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
      key: 'bgp_route_propagation_enabled',
      label: 'BGP Route Propagation',
      type: 'boolean',
      required: false,
      group: 'General',
      order: 2,
      defaultValue: true,
      description: 'Allow gateway routes to propagate into this route table (disable for forced-tunnel or NVA scenarios)',
    },
  ],

  handles: [],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
    { key: 'name', label: 'Name', terraformAttribute: 'name' },
  ],
};
