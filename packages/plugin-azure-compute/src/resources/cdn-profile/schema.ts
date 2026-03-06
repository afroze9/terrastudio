import type { ResourceSchema } from '@terrastudio/types';

export const cdnProfileSchema: ResourceSchema = {
  typeId: 'azurerm/web/cdn_profile',
  provider: 'azurerm',
  displayName: 'CDN Profile',
  category: 'web',
  description: 'Azure CDN profile for content delivery',
  terraformType: 'azurerm_cdn_profile',
  supportsTags: true,
  requiresResourceGroup: true,
  cafAbbreviation: 'cdnp',
  namingConstraints: { maxLength: 260 },
  isContainer: true,
  canBeChildOf: ['azurerm/core/resource_group'],
  containerStyle: {
    borderColor: '#E65100',
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
      placeholder: 'cdn-myapp',
      group: 'General',
      order: 1,
      validation: { minLength: 1, maxLength: 260 },
    },
    {
      key: 'sku',
      label: 'SKU',
      type: 'select',
      required: true,
      group: 'General',
      order: 2,
      defaultValue: 'Standard_Microsoft',
      options: [
        { label: 'Standard Microsoft', value: 'Standard_Microsoft' },
        { label: 'Standard Verizon', value: 'Standard_Verizon' },
        { label: 'Premium Verizon', value: 'Premium_Verizon' },
      ],
    },
  ],
  handles: [],
  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
  ],

  costEstimation: {
    serviceName: 'CDN',
    skuProperty: 'sku',
    usageInputs: [
      {
        key: '_cost_data_gb',
        label: 'Data Transfer',
        unit: 'GB/mo',
        defaultValue: 100,
        min: 0,
        max: 1000000,
        description: 'Monthly data transferred through CDN (~$0.081–$0.135/GB depending on SKU)',
      },
    ],
  },
};
