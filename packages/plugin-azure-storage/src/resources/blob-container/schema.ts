import type { ResourceSchema } from '@terrastudio/types';

export const blobContainerSchema: ResourceSchema = {
  typeId: 'azurerm/storage/blob_container',
  provider: 'azurerm',
  displayName: 'Blob Container',
  category: 'storage',
  description: 'Azure Blob Storage container for unstructured data',
  terraformType: 'azurerm_storage_container',
  supportsTags: false,
  requiresResourceGroup: false,
  cafAbbreviation: 'blob',
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
      placeholder: 'my-container',
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
      key: 'container_access_type',
      label: 'Access Level',
      type: 'select',
      required: false,
      group: 'General',
      order: 2,
      defaultValue: 'private',
      options: [
        { label: 'Private (no anonymous access)', value: 'private' },
        { label: 'Blob (anonymous read for blobs)', value: 'blob' },
        { label: 'Container (anonymous read for container and blobs)', value: 'container' },
      ],
    },
  ],

  parentReference: { propertyKey: 'storage_account_id' },

  handles: [],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
  ],
};
