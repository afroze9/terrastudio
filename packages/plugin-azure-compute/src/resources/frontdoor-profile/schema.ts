import type { ResourceSchema } from '@terrastudio/types';

export const frontdoorProfileSchema: ResourceSchema = {
  typeId: 'azurerm/web/frontdoor_profile',
  provider: 'azurerm',
  displayName: 'Front Door Profile',
  category: 'web',
  description: 'Azure Front Door profile for global load balancing and CDN',
  terraformType: 'azurerm_cdn_frontdoor_profile',
  supportsTags: true,
  requiresResourceGroup: true,
  canBeChildOf: ['azurerm/core/resource_group'],
  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'fd-myapp',
      group: 'General',
      order: 1,
      validation: { minLength: 1, maxLength: 260 },
    },
    {
      key: 'sku_name',
      label: 'SKU',
      type: 'select',
      required: true,
      group: 'General',
      order: 2,
      defaultValue: 'Standard_AzureFrontDoor',
      options: [
        { label: 'Standard', value: 'Standard_AzureFrontDoor' },
        { label: 'Premium', value: 'Premium_AzureFrontDoor' },
      ],
    },
    {
      key: 'response_timeout_seconds',
      label: 'Response Timeout (seconds)',
      type: 'number',
      required: false,
      group: 'Settings',
      order: 3,
      defaultValue: 120,
      description: 'Timeout in seconds for backend responses',
      validation: { min: 16, max: 240 },
    },
  ],
  handles: [],
  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
    { key: 'resource_guid', label: 'Resource GUID', terraformAttribute: 'resource_guid' },
  ],
};
