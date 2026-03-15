import type { ResourceTypeRegistration } from '@terrastudio/types';
import { cosmosdbSqlDatabaseSchema } from './schema.js';
import { cosmosdbSqlDatabaseHclGenerator } from './hcl-generator.js';
import { cosmosdbSqlDatabaseIcon } from './icon.js';

export const cosmosdbSqlDatabaseRegistration: ResourceTypeRegistration = {
  schema: cosmosdbSqlDatabaseSchema,
  nodeComponent: null,
  hclGenerator: cosmosdbSqlDatabaseHclGenerator,
  icon: cosmosdbSqlDatabaseIcon,
};
