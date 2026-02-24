import type { ResourceSchema } from '@terrastudio/types';

export const tableSchema: ResourceSchema = {
  typeId: 'azurerm/storage/table',
  provider: 'azurerm',
  displayName: 'Table',
  category: 'storage',
  description: 'Azure Table Storage for structured NoSQL data',
  terraformType: 'azurerm_storage_table',
  supportsTags: false,
  requiresResourceGroup: false,
  cafAbbreviation: 'table',
  namingConstraints: { noHyphens: true, maxLength: 63 },
  canBeChildOf: [
    'azurerm/storage/storage_account',
  ],

  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'mytable',
      group: 'General',
      order: 1,
      validation: {
        minLength: 3,
        maxLength: 63,
        pattern: '^[A-Za-z][A-Za-z0-9]*$',
        patternMessage: 'Must start with a letter and contain only letters and numbers',
      },
    },
  ],

  parentReference: { propertyKey: 'storage_account_name' },

  handles: [],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
  ],
};
