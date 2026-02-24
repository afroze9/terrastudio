import type { ResourceSchema } from '@terrastudio/types';

export const vnetIntegrationSchema: ResourceSchema = {
  typeId: 'azurerm/networking/vnet_integration',
  provider: 'azurerm',
  displayName: 'VNet Integration',
  category: 'networking',
  description: 'App Service / Function App VNet Integration — injects a virtual NIC into a subnet for outbound private connectivity',
  terraformType: 'azurerm_app_service_virtual_network_swift_connection',
  supportsTags: false,
  requiresResourceGroup: false,
  cafAbbreviation: 'vnetint',

  canBeChildOf: ['azurerm/networking/subnet'],
  parentReference: { propertyKey: 'subnet_id' },

  properties: [
    {
      key: 'app_service_id',
      label: 'App Service',
      type: 'reference',
      required: true,
      group: 'Connection',
      order: 1,
      description: 'The App Service or Function App whose outbound traffic routes through this subnet',
      referenceTargetTypes: [
        'azurerm/compute/app_service',
        'azurerm/compute/function_app',
      ],
      showAsEdge: true,
    },
  ],

  handles: [],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
    { key: 'subnet_id', label: 'Subnet ID', terraformAttribute: 'subnet_id' },
  ],
};
