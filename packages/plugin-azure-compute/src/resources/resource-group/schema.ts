import type { ResourceSchema } from '@terrastudio/types';

export const resourceGroupSchema: ResourceSchema = {
  typeId: 'azurerm/core/resource_group',
  provider: 'azurerm',
  displayName: 'Resource Group',
  category: 'core',
  description: 'Azure Resource Group — logical container for related resources',
  terraformType: 'azurerm_resource_group',
  supportsTags: true,
  requiresResourceGroup: false,
  isContainer: true,
  acceptsChildren: [
    'azurerm/networking/virtual_network',
    'azurerm/networking/network_security_group',
    'azurerm/compute/virtual_machine',
  ],

  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'rg-myproject-dev',
      group: 'General',
      order: 1,
      validation: {
        minLength: 1,
        maxLength: 90,
        pattern: '^[-\\w._()]+$',
        patternMessage: 'Alphanumerics, underscores, hyphens, periods, and parentheses',
      },
    },
    {
      key: 'location',
      label: 'Location',
      type: 'select',
      required: true,
      group: 'General',
      order: 2,
      defaultValue: 'eastus',
      options: [
        { label: 'East US', value: 'eastus' },
        { label: 'East US 2', value: 'eastus2' },
        { label: 'West US', value: 'westus' },
        { label: 'West US 2', value: 'westus2' },
        { label: 'Central US', value: 'centralus' },
        { label: 'North Europe', value: 'northeurope' },
        { label: 'West Europe', value: 'westeurope' },
        { label: 'UK South', value: 'uksouth' },
        { label: 'Southeast Asia', value: 'southeastasia' },
        { label: 'Australia East', value: 'australiaeast' },
      ],
    },
  ],

  handles: [
    {
      id: 'resources-out',
      type: 'source',
      position: 'bottom',
      label: 'Resources',
    },
  ],
};
