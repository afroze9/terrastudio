import type { ResourceSchema } from '@terrastudio/types';

export const vnetSchema: ResourceSchema = {
  typeId: 'azurerm/networking/virtual_network',
  provider: 'azurerm',
  displayName: 'Virtual Network',
  category: 'networking',
  description: 'Azure Virtual Network (VNet) for isolating cloud resources',
  terraformType: 'azurerm_virtual_network',
  supportsTags: true,
  requiresResourceGroup: true,
  isContainer: true,
  canBeChildOf: [
    'azurerm/core/resource_group',
  ],

  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'my-vnet',
      group: 'General',
      order: 1,
      validation: {
        minLength: 2,
        maxLength: 64,
        pattern: '^[a-zA-Z0-9][a-zA-Z0-9_.-]*[a-zA-Z0-9_]$',
        patternMessage: 'Must start with alphanumeric, end with alphanumeric or underscore',
      },
    },
    {
      key: 'address_space',
      label: 'Address Space',
      type: 'array',
      required: true,
      description: 'CIDR blocks for the virtual network',
      group: 'Networking',
      order: 2,
      itemSchema: {
        key: 'cidr',
        label: 'CIDR Block',
        type: 'cidr',
        required: true,
        placeholder: '10.0.0.0/16',
      },
      defaultValue: ['10.0.0.0/16'],
    },
    {
      key: 'dns_servers',
      label: 'DNS Servers',
      type: 'array',
      required: false,
      description: 'Custom DNS server IP addresses',
      group: 'Networking',
      order: 3,
      itemSchema: {
        key: 'dns_server',
        label: 'DNS Server',
        type: 'string',
        required: true,
        placeholder: '10.0.0.4',
      },
    },
  ],

  handles: [
    {
      id: 'subnet-out',
      type: 'source',
      position: 'bottom',
      label: 'Subnets',
    },
  ],
};
