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
    borderColor: '#2B7CF6',
    borderStyle: 'solid',
    backgroundColor: '#ffffff',
    headerColor: '#1a1a2e',
    borderRadius: 12,
    borderWidth: 2.5,
    hideHeaderBorder: true,
    iconSize: 28,
    labelSize: 16,
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
