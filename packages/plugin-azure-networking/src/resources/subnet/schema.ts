import type { ResourceSchema } from '@terrastudio/types';

export const subnetSchema: ResourceSchema = {
  typeId: 'azurerm/networking/subnet',
  provider: 'azurerm',
  displayName: 'Subnet',
  category: 'networking',
  description: 'Azure Subnet within a Virtual Network',
  terraformType: 'azurerm_subnet',
  supportsTags: false,
  requiresResourceGroup: true,
  isContainer: true,
  canBeChildOf: [
    'azurerm/networking/virtual_network',
  ],
  containerStyle: {
    borderColor: '#8b5cf6',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(139, 92, 246, 0.06)',
    headerColor: '#8b5cf6',
    borderRadius: 8,
  },

  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'default',
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
      key: 'address_prefixes',
      label: 'Address Prefixes',
      type: 'array',
      required: true,
      description: 'CIDR blocks for the subnet',
      group: 'Networking',
      order: 2,
      itemSchema: {
        key: 'cidr',
        label: 'CIDR Block',
        type: 'cidr',
        required: true,
        placeholder: '10.0.1.0/24',
      },
      defaultValue: ['10.0.1.0/24'],
    },
    {
      key: 'service_endpoints',
      label: 'Service Endpoints',
      type: 'multiselect',
      required: false,
      description: 'Azure service endpoints to enable',
      group: 'Advanced',
      order: 3,
      options: [
        { label: 'Microsoft.Storage', value: 'Microsoft.Storage' },
        { label: 'Microsoft.Sql', value: 'Microsoft.Sql' },
        { label: 'Microsoft.KeyVault', value: 'Microsoft.KeyVault' },
        { label: 'Microsoft.Web', value: 'Microsoft.Web' },
      ],
    },
  ],

  parentReference: { propertyKey: 'virtual_network_name' },

  handles: [
    {
      id: 'nsg-in',
      type: 'target',
      position: 'right',
      label: 'NSG',
      acceptsTypes: ['azurerm/networking/network_security_group'],
      maxConnections: 1,
    },
  ],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
  ],
};
