import type { ResourceSchema } from '@terrastudio/types';

export const mysqlFlexibleServerDatabaseSchema: ResourceSchema = {
  typeId: 'azurerm/database/mysql_flexible_server_database',
  provider: 'azurerm',
  displayName: 'MySQL Database',
  category: 'mysql',
  description: 'A database on an Azure MySQL Flexible Server',
  terraformType: 'azurerm_mysql_flexible_server_database',
  supportsTags: false,
  requiresResourceGroup: false,

  canBeChildOf: [
    'azurerm/database/mysql_flexible_server',
  ],

  parentReference: { propertyKey: 'server_name' },

  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'mydb',
      group: 'General',
      order: 1,
      validation: {
        minLength: 1,
        maxLength: 63,
      },
    },
    {
      key: 'charset',
      label: 'Character Set',
      type: 'select',
      required: false,
      group: 'General',
      order: 2,
      defaultValue: 'utf8mb4',
      options: [
        { label: 'utf8mb4 (recommended)', value: 'utf8mb4' },
        { label: 'utf8', value: 'utf8' },
        { label: 'latin1', value: 'latin1' },
      ],
    },
    {
      key: 'collation',
      label: 'Collation',
      type: 'select',
      required: false,
      group: 'General',
      order: 3,
      defaultValue: 'utf8mb4_unicode_ci',
      options: [
        { label: 'utf8mb4_unicode_ci (recommended)', value: 'utf8mb4_unicode_ci' },
        { label: 'utf8mb4_general_ci', value: 'utf8mb4_general_ci' },
        { label: 'utf8_general_ci', value: 'utf8_general_ci' },
        { label: 'latin1_swedish_ci', value: 'latin1_swedish_ci' },
      ],
    },
  ],

  handles: [],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
  ],
};
