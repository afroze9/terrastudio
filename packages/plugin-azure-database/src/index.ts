import type { InfraPlugin, ResourceTypeId, ResourceTypeRegistration } from '@terrastudio/types';
import { mssqlServerRegistration } from './resources/mssql-server/index.js';
import { mssqlDatabaseRegistration } from './resources/mssql-database/index.js';
import { redisCacheRegistration } from './resources/redis-cache/index.js';
import { postgresqlFlexibleServerRegistration } from './resources/postgresql-flexible-server/index.js';
import { postgresqlFlexibleServerDatabaseRegistration } from './resources/postgresql-flexible-server-database/index.js';
import { cosmosdbAccountRegistration } from './resources/cosmosdb-account/index.js';
import { cosmosdbSqlDatabaseRegistration } from './resources/cosmosdb-sql-database/index.js';
import { databaseConnectionRules } from './connections/rules.js';

const resourceTypes = new Map<ResourceTypeId, ResourceTypeRegistration>([
  ['azurerm/database/mssql_server', mssqlServerRegistration],
  ['azurerm/database/mssql_database', mssqlDatabaseRegistration],
  ['azurerm/database/redis_cache', redisCacheRegistration],
  ['azurerm/database/postgresql_flexible_server', postgresqlFlexibleServerRegistration],
  ['azurerm/database/postgresql_flexible_server_database', postgresqlFlexibleServerDatabaseRegistration],
  ['azurerm/database/cosmosdb_account', cosmosdbAccountRegistration],
  ['azurerm/database/cosmosdb_sql_database', cosmosdbSqlDatabaseRegistration],
]);

const plugin: InfraPlugin = {
  id: '@terrastudio/plugin-azure-database',
  name: 'Azure Database',
  version: '0.1.0',
  providerId: 'azurerm',

  resourceTypes,
  connectionRules: databaseConnectionRules,

  paletteCategories: [
    {
      id: 'database',
      label: 'SQL Database',
      order: 25,
    },
    {
      id: 'postgresql',
      label: 'PostgreSQL',
      order: 26,
    },
    {
      id: 'cache',
      label: 'Cache',
      order: 27,
    },
    {
      id: 'cosmosdb',
      label: 'Cosmos DB',
      order: 28,
    },
  ],
};

export default plugin;
