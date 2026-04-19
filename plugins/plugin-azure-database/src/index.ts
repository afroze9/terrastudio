import type { InfraPlugin, ResourceTypeId, ResourceTypeRegistration } from '@terrastudio/types';
import { mssqlServerRegistration } from './resources/mssql-server/index.js';
import { mssqlDatabaseRegistration } from './resources/mssql-database/index.js';
import { redisCacheRegistration } from './resources/redis-cache/index.js';
import { postgresqlFlexibleServerRegistration } from './resources/postgresql-flexible-server/index.js';
import { postgresqlFlexibleServerDatabaseRegistration } from './resources/postgresql-flexible-server-database/index.js';
import { cosmosdbAccountRegistration } from './resources/cosmosdb-account/index.js';
import { cosmosdbSqlDatabaseRegistration } from './resources/cosmosdb-sql-database/index.js';
import { mysqlFlexibleServerRegistration } from './resources/mysql-flexible-server/index.js';
import { mysqlFlexibleServerDatabaseRegistration } from './resources/mysql-flexible-server-database/index.js';
import { mssqlManagedInstanceRegistration } from './resources/mssql-managed-instance/index.js';
import { mssqlManagedInstanceAadAdministratorRegistration } from './resources/mssql-managed-instance-aad-administrator/index.js';
import { databaseConnectionRules } from './connections/rules.js';

const resourceTypes = new Map<ResourceTypeId, ResourceTypeRegistration>([
  ['azurerm/database/mssql_server', mssqlServerRegistration],
  ['azurerm/database/mssql_database', mssqlDatabaseRegistration],
  ['azurerm/database/redis_cache', redisCacheRegistration],
  ['azurerm/database/postgresql_flexible_server', postgresqlFlexibleServerRegistration],
  ['azurerm/database/postgresql_flexible_server_database', postgresqlFlexibleServerDatabaseRegistration],
  ['azurerm/database/cosmosdb_account', cosmosdbAccountRegistration],
  ['azurerm/database/cosmosdb_sql_database', cosmosdbSqlDatabaseRegistration],
  ['azurerm/database/mysql_flexible_server', mysqlFlexibleServerRegistration],
  ['azurerm/database/mysql_flexible_server_database', mysqlFlexibleServerDatabaseRegistration],
  ['azurerm/database/mssql_managed_instance', mssqlManagedInstanceRegistration],
  ['azurerm/database/mssql_managed_instance_aad_administrator', mssqlManagedInstanceAadAdministratorRegistration],
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
      id: 'mysql',
      label: 'MySQL',
      order: 27,
    },
    {
      id: 'cache',
      label: 'Cache',
      order: 28,
    },
    {
      id: 'cosmosdb',
      label: 'Cosmos DB',
      order: 29,
    },
    {
      id: 'managed-instance',
      label: 'SQL Managed Instance',
      order: 30,
    },
  ],
};

export default plugin;
