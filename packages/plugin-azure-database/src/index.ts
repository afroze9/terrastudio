import type { InfraPlugin, ResourceTypeId, ResourceTypeRegistration } from '@terrastudio/types';
import { mssqlServerRegistration } from './resources/mssql-server/index.js';
import { mssqlDatabaseRegistration } from './resources/mssql-database/index.js';
import { databaseConnectionRules } from './connections/rules.js';

const resourceTypes = new Map<ResourceTypeId, ResourceTypeRegistration>([
  ['azurerm/database/mssql_server', mssqlServerRegistration],
  ['azurerm/database/mssql_database', mssqlDatabaseRegistration],
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
      label: 'Database',
      order: 25,
    },
  ],
};

export default plugin;
