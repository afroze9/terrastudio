import type { ResourceSchema } from '@terrastudio/types';

export const postgresqlFlexibleServerDatabaseSchema: ResourceSchema = {
  typeId: 'azurerm/database/postgresql_flexible_server_database',
  provider: 'azurerm',
  displayName: 'PostgreSQL Database',
  category: 'postgresql',
  description: 'A database on an Azure PostgreSQL Flexible Server',
  terraformType: 'azurerm_postgresql_flexible_server_database',
  supportsTags: false,
  requiresResourceGroup: false,

  canBeChildOf: [
    'azurerm/database/postgresql_flexible_server',
  ],

  parentReference: { propertyKey: 'server_id' },

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
      defaultValue: 'UTF8',
      options: [
        { label: 'UTF8 (recommended)', value: 'UTF8' },
        { label: 'SQL_ASCII', value: 'SQL_ASCII' },
      ],
    },
    {
      key: 'collation',
      label: 'Collation',
      type: 'string',
      required: false,
      group: 'General',
      order: 3,
      defaultValue: 'en_US.utf8',
      placeholder: 'en_US.utf8',
    },
  ],

  handles: [],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
  ],
};
