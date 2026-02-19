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
  acceptsChildren: [
    'azurerm/compute/virtual_machine',
  ],

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

  handles: [
    {
      id: 'vnet-in',
      type: 'target',
      position: 'top',
      label: 'Virtual Network',
      acceptsTypes: ['azurerm/networking/virtual_network'],
      maxConnections: 1,
    },
    {
      id: 'resource-out',
      type: 'source',
      position: 'bottom',
      label: 'Resources',
    },
    {
      id: 'nsg-in',
      type: 'target',
      position: 'right',
      label: 'NSG',
      acceptsTypes: ['azurerm/networking/network_security_group'],
      maxConnections: 1,
    },
  ],
};
