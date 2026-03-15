import type { ResourceTypeRegistration } from '@terrastudio/types';
import { mssqlDatabaseSchema } from './schema.js';
import { mssqlDatabaseHclGenerator } from './hcl-generator.js';
import { mssqlDatabaseIcon } from './icon.js';

export const mssqlDatabaseRegistration: ResourceTypeRegistration = {
  schema: mssqlDatabaseSchema,
  nodeComponent: null,
  hclGenerator: mssqlDatabaseHclGenerator,
  icon: mssqlDatabaseIcon,
};
