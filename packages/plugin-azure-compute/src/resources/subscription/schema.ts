import type { ResourceSchema } from '@terrastudio/types';

export const subscriptionSchema: ResourceSchema = {
  typeId: 'azurerm/core/subscription',
  provider: 'azurerm',
  displayName: 'Subscription',
  category: 'core',
  description: 'Azure Subscription — top-level billing and access boundary',
  terraformType: '_subscription', // virtual — no Terraform resource
  supportsTags: false,
  requiresResourceGroup: false,
  isContainer: true,
  containerStyle: {
    borderColor: '#3b82f6',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    headerColor: '#60a5fa',
    borderRadius: 16,
  },

  properties: [
    {
      key: 'display_name',
      label: 'Display Name',
      type: 'string',
      required: true,
      placeholder: 'My Azure Subscription',
      group: 'General',
      order: 1,
    },
    {
      key: 'subscription_id',
      label: 'Subscription ID',
      type: 'string',
      required: true,
      placeholder: '00000000-0000-0000-0000-000000000000',
      group: 'General',
      order: 2,
      validation: {
        pattern:
          '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
        patternMessage: 'Must be a valid UUID',
      },
    },
  ],

  handles: [],

  outputs: [
    {
      key: 'subscription_id',
      label: 'Subscription ID',
      terraformAttribute: 'subscription_id',
    },
  ],
};
