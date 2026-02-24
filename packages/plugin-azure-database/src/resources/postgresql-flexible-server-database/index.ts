import type { ResourceTypeRegistration } from '@terrastudio/types';
import { postgresqlFlexibleServerDatabaseSchema } from './schema.js';
import { postgresqlFlexibleServerDatabaseHclGenerator } from './hcl-generator.js';
import { postgresqlFlexibleServerDatabaseIcon } from './icon.js';

export const postgresqlFlexibleServerDatabaseRegistration: ResourceTypeRegistration = {
  schema: postgresqlFlexibleServerDatabaseSchema,
  nodeComponent: null,
  hclGenerator: postgresqlFlexibleServerDatabaseHclGenerator,
  icon: postgresqlFlexibleServerDatabaseIcon,
};
