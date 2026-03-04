import type { ResourceTypeRegistration } from '@terrastudio/types';
import { mysqlFlexibleServerDatabaseSchema } from './schema.js';
import { mysqlFlexibleServerDatabaseHclGenerator } from './hcl-generator.js';
import { mysqlFlexibleServerDatabaseIcon } from './icon.js';

export const mysqlFlexibleServerDatabaseRegistration: ResourceTypeRegistration = {
  schema: mysqlFlexibleServerDatabaseSchema,
  nodeComponent: null,
  hclGenerator: mysqlFlexibleServerDatabaseHclGenerator,
  icon: mysqlFlexibleServerDatabaseIcon,
};
