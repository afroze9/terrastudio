import type { ResourceSchema } from '@terrastudio/types';

export const queueSchema: ResourceSchema = {
  typeId: 'azurerm/storage/queue',
  provider: 'azurerm',
  displayName: 'Queue',
  category: 'storage',
  description: 'Azure Storage Queue for asynchronous message processing',
  terraformType: 'azurerm_storage_queue',
  supportsTags: false,
  requiresResourceGroup: false,
  cafAbbreviation: 'queue',
  namingConstraints: { lowercase: true, maxLength: 63 },
  canBeChildOf: [
    'azurerm/storage/storage_account',
  ],

  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'my-queue',
      group: 'General',
      order: 1,
      validation: {
        minLength: 3,
        maxLength: 63,
        pattern: '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$',
        patternMessage: 'Must be 3-63 lowercase letters, numbers, and hyphens',
      },
    },
  ],

  parentReference: { propertyKey: 'storage_account_id' },

  handles: [],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
  ],
};
