import type { ResourceSchema } from '@terrastudio/types';

export const aiFoundryProjectSchema: ResourceSchema = {
  typeId: 'azurerm/ai/ai_foundry_project',
  provider: 'azurerm',
  displayName: 'AI Foundry Project',
  category: 'ai',
  description: 'Azure AI Foundry project within a hub for organizing AI workloads',
  terraformType: 'azurerm_ai_foundry_project',
  supportsTags: false,
  requiresResourceGroup: true,
  cafAbbreviation: 'aiproj',

  canBeChildOf: [
    'azurerm/ai/ai_foundry',
  ],

  parentReference: { propertyKey: 'ai_services_hub_id' },

  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'aiproj-myworkload-dev',
      group: 'General',
      order: 1,
      validation: {
        minLength: 2,
        maxLength: 64,
      },
    },
    {
      key: 'friendly_name',
      label: 'Friendly Name',
      type: 'string',
      required: false,
      placeholder: 'My AI Project',
      group: 'General',
      order: 2,
    },
    {
      key: 'description',
      label: 'Description',
      type: 'string',
      required: false,
      placeholder: 'AI project for model training and deployment',
      group: 'General',
      order: 3,
    },
  ],

  handles: [],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
  ],
};
