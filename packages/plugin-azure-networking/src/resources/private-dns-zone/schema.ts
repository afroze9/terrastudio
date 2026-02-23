import type { ResourceSchema } from '@terrastudio/types';

export const privateDnsZoneSchema: ResourceSchema = {
  typeId: 'azurerm/networking/private_dns_zone',
  provider: 'azurerm',
  displayName: 'Private DNS Zone',
  category: 'networking',
  description: 'Azure Private DNS Zone for private endpoint name resolution',
  terraformType: 'azurerm_private_dns_zone',
  supportsTags: true,
  requiresResourceGroup: true,
  cafAbbreviation: 'pdz',

  canBeChildOf: [
    'azurerm/core/resource_group',
  ],

  properties: [
    {
      key: 'name',
      label: 'Zone Name',
      type: 'string',
      required: true,
      placeholder: 'privatelink.blob.core.windows.net',
      group: 'General',
      order: 1,
      description: 'Common zones: privatelink.blob.core.windows.net, privatelink.vaultcore.azure.net, privatelink.database.windows.net, privatelink.azurecr.io, privatelink.azurewebsites.net',
      validation: {
        minLength: 3,
        maxLength: 253,
        pattern: '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$',
        patternMessage: 'Must be a valid DNS zone name (e.g. privatelink.blob.core.windows.net)',
      },
    },
  ],

  handles: [],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
    { key: 'number_of_record_sets', label: 'Record Set Count', terraformAttribute: 'number_of_record_sets' },
    { key: 'max_number_of_record_sets', label: 'Max Record Sets', terraformAttribute: 'max_number_of_record_sets' },
  ],
};
