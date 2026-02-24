import type { ResourceSchema } from '@terrastudio/types';

export const cosmosdbSqlDatabaseSchema: ResourceSchema = {
  typeId: 'azurerm/database/cosmosdb_sql_database',
  provider: 'azurerm',
  displayName: 'Cosmos DB SQL Database',
  category: 'cosmosdb',
  description: 'A SQL (NoSQL) database within a Cosmos DB account',
  terraformType: 'azurerm_cosmosdb_sql_database',
  supportsTags: false,
  requiresResourceGroup: true,

  canBeChildOf: [
    'azurerm/database/cosmosdb_account',
  ],

  parentReference: { propertyKey: 'account_id' },

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
        maxLength: 255,
      },
    },
    {
      key: 'throughput',
      label: 'Throughput (RU/s)',
      type: 'number',
      required: false,
      group: 'Performance',
      order: 2,
      description: 'Manual throughput in RU/s. Leave empty for serverless accounts.',
      validation: {
        min: 400,
        max: 1000000,
      },
    },
  ],

  handles: [],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
  ],
};
