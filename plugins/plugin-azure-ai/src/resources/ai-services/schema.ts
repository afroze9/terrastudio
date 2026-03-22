import type { ResourceSchema } from '@terrastudio/types';

export const aiServicesSchema: ResourceSchema = {
  typeId: 'azurerm/ai/ai_services',
  provider: 'azurerm',
  displayName: 'AI Services',
  category: 'ai',
  description: 'Azure AI Services multi-service account for accessing multiple AI capabilities',
  terraformType: 'azurerm_ai_services',
  supportsTags: true,
  requiresResourceGroup: true,
  cafAbbreviation: 'ais',
  canBeChildOf: ['azurerm/core/resource_group'],

  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'my-ai-services',
      group: 'General',
      order: 1,
    },
    {
      key: 'sku_name',
      label: 'SKU',
      type: 'select',
      required: true,
      group: 'General',
      order: 2,
      defaultValue: 'S0',
      options: [
        { label: 'F0 (Free)', value: 'F0' },
        { label: 'S0 (Standard)', value: 'S0' },
      ],
    },
    {
      key: 'custom_subdomain_name',
      label: 'Custom Subdomain Name',
      type: 'string',
      required: false,
      placeholder: 'my-ai-subdomain',
      group: 'General',
      order: 3,
      description: 'Custom subdomain for the AI Services endpoint',
    },
    {
      key: 'public_network_access_enabled',
      label: 'Public Network Access',
      type: 'boolean',
      required: false,
      group: 'Security',
      order: 4,
      defaultValue: true,
    },
    {
      key: 'local_auth_enabled',
      label: 'Local Authentication',
      type: 'boolean',
      required: false,
      group: 'Security',
      order: 5,
      defaultValue: true,
      description: 'Enable authentication using API keys',
    },
  ],

  handles: [
    {
      id: 'ai-services-out',
      type: 'source',
      position: 'right',
      label: 'AI Services',
    },
  ],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
    { key: 'endpoint', label: 'API Endpoint', terraformAttribute: 'endpoint' },
    {
      key: 'primary_access_key',
      label: 'Primary Access Key',
      terraformAttribute: 'primary_access_key',
      sensitive: true,
    },
  ],
};
