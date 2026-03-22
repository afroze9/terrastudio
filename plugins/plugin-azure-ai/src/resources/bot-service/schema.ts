import type { ResourceSchema } from '@terrastudio/types';

export const botServiceSchema: ResourceSchema = {
  typeId: 'azurerm/ai/bot_service',
  provider: 'azurerm',
  displayName: 'Bot Service',
  category: 'ai',
  description: 'Azure Bot Service for building and deploying conversational AI bots',
  terraformType: 'azurerm_bot_service_azure_bot',
  supportsTags: true,
  requiresResourceGroup: true,
  cafAbbreviation: 'bot',

  canBeChildOf: [
    'azurerm/core/resource_group',
  ],

  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'bot-myapp-dev',
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
      defaultValue: 'F0',
      options: [
        { label: 'Free (F0)', value: 'F0' },
        { label: 'Standard (S1)', value: 'S1' },
      ],
    },
    {
      key: 'microsoft_app_id',
      label: 'Microsoft App ID',
      type: 'string',
      required: true,
      group: 'Identity',
      order: 3,
      description: 'Microsoft App Registration ID (GUID)',
      placeholder: '00000000-0000-0000-0000-000000000000',
    },
    {
      key: 'microsoft_app_type',
      label: 'Microsoft App Type',
      type: 'select',
      required: false,
      group: 'Identity',
      order: 4,
      defaultValue: 'MultiTenant',
      options: [
        { label: 'Single Tenant', value: 'SingleTenant' },
        { label: 'Multi Tenant', value: 'MultiTenant' },
        { label: 'User Assigned MSI', value: 'UserAssignedMSI' },
      ],
    },
    {
      key: 'endpoint',
      label: 'Messaging Endpoint',
      type: 'string',
      required: false,
      group: 'Configuration',
      order: 5,
      placeholder: 'https://mybot.azurewebsites.net/api/messages',
      description: 'Bot messaging endpoint URL',
    },
  ],

  handles: [],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
  ],
};
