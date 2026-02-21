import type { ResourceSchema } from '@terrastudio/types';

export const fileShareSchema: ResourceSchema = {
  typeId: 'azurerm/storage/file_share',
  provider: 'azurerm',
  displayName: 'File Share',
  category: 'storage',
  description: 'Azure Files share for SMB/NFS file storage',
  terraformType: 'azurerm_storage_share',
  supportsTags: false,
  requiresResourceGroup: false,
  canBeChildOf: [
    'azurerm/storage/storage_account',
  ],

  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'my-share',
      group: 'General',
      order: 1,
      validation: {
        minLength: 3,
        maxLength: 63,
        pattern: '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$',
        patternMessage: 'Must be 3-63 lowercase letters, numbers, and hyphens',
      },
    },
    {
      key: 'quota',
      label: 'Quota (GB)',
      type: 'number',
      required: true,
      group: 'General',
      order: 2,
      defaultValue: 50,
      validation: {
        min: 1,
        max: 102400,
      },
    },
    {
      key: 'access_tier',
      label: 'Access Tier',
      type: 'select',
      required: false,
      group: 'General',
      order: 3,
      defaultValue: 'Hot',
      options: [
        { label: 'Hot', value: 'Hot' },
        { label: 'Cool', value: 'Cool' },
        { label: 'Transaction Optimized', value: 'TransactionOptimized' },
      ],
    },
    {
      key: 'enabled_protocol',
      label: 'Protocol',
      type: 'select',
      required: false,
      group: 'Advanced',
      order: 4,
      defaultValue: 'SMB',
      options: [
        { label: 'SMB', value: 'SMB' },
        { label: 'NFS', value: 'NFS' },
      ],
    },
  ],

  parentReference: { propertyKey: 'storage_account_id' },

  handles: [],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
    { key: 'url', label: 'URL', terraformAttribute: 'url' },
  ],
};
