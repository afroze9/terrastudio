import type { ResourceSchema } from '@terrastudio/types';

export const raiPolicySchema: ResourceSchema = {
  typeId: 'azurerm/ai/rai_policy',
  provider: 'azurerm',
  displayName: 'RAI Policy',
  category: 'ai',
  description: 'Azure Responsible AI content filter policy for Cognitive Services',
  terraformType: 'azurerm_cognitive_account_rai_policy',
  supportsTags: false,
  requiresResourceGroup: false,
  cafAbbreviation: 'raip',
  canBeChildOf: ['azurerm/core/resource_group'],

  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'my-rai-policy',
      group: 'General',
      order: 1,
    },
    {
      key: 'base_policy_name',
      label: 'Base Policy Name',
      type: 'string',
      required: true,
      group: 'General',
      order: 2,
      defaultValue: 'Microsoft.DefaultV2',
      description: 'Base policy to inherit from',
    },
  ],

  handles: [
    {
      id: 'cognitive-account-in',
      type: 'target',
      position: 'left',
      label: 'AI Account',
    },
  ],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
  ],
};
