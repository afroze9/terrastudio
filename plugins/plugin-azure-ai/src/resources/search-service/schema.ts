import type { ResourceSchema } from '@terrastudio/types';

export const searchServiceSchema: ResourceSchema = {
  typeId: 'azurerm/ai/search_service',
  provider: 'azurerm',
  displayName: 'Search Service',
  category: 'ai',
  description: 'Azure AI Search (formerly Cognitive Search) for full-text search and AI enrichment',
  terraformType: 'azurerm_search_service',
  supportsTags: true,
  requiresResourceGroup: true,
  cafAbbreviation: 'srch',

  canBeChildOf: [
    'azurerm/core/resource_group',
  ],

  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'srch-myapp-dev',
      group: 'General',
      order: 1,
    },
    {
      key: 'sku',
      label: 'SKU',
      type: 'select',
      required: true,
      group: 'General',
      order: 2,
      defaultValue: 'standard',
      options: [
        { label: 'Free', value: 'free' },
        { label: 'Basic', value: 'basic' },
        { label: 'Standard', value: 'standard' },
        { label: 'Standard 2', value: 'standard2' },
        { label: 'Standard 3', value: 'standard3' },
        { label: 'Storage Optimized L1', value: 'storage_optimized_l1' },
        { label: 'Storage Optimized L2', value: 'storage_optimized_l2' },
      ],
    },
    {
      key: 'replica_count',
      label: 'Replica Count',
      type: 'number',
      required: false,
      group: 'Scale',
      order: 3,
      defaultValue: 1,
      validation: { min: 1, max: 12 },
    },
    {
      key: 'partition_count',
      label: 'Partition Count',
      type: 'number',
      required: false,
      group: 'Scale',
      order: 4,
      defaultValue: 1,
      validation: { min: 1, max: 12 },
    },
    {
      key: 'public_network_access_enabled',
      label: 'Public Network Access',
      type: 'boolean',
      required: false,
      group: 'Networking',
      order: 5,
      defaultValue: true,
    },
    {
      key: 'hosting_mode',
      label: 'Hosting Mode',
      type: 'select',
      required: false,
      group: 'Advanced',
      order: 6,
      defaultValue: 'default',
      visibleWhen: { field: 'sku', operator: 'eq', value: 'standard3' },
      options: [
        { label: 'Default', value: 'default' },
        { label: 'High Density', value: 'highDensity' },
      ],
    },
  ],

  handles: [],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
    { key: 'primary_key', label: 'Primary Key', terraformAttribute: 'primary_key', sensitive: true },
    { key: 'secondary_key', label: 'Secondary Key', terraformAttribute: 'secondary_key', sensitive: true },
  ],
};
