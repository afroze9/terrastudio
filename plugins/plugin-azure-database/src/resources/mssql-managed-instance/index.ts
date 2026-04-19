import type { ResourceTypeRegistration } from '@terrastudio/types';
import { mssqlManagedInstanceSchema } from './schema.js';
import { mssqlManagedInstanceHclGenerator } from './hcl-generator.js';
import { mssqlManagedInstanceIcon } from './icon.js';

export const mssqlManagedInstanceRegistration: ResourceTypeRegistration = {
  schema: mssqlManagedInstanceSchema,
  nodeComponent: null,
  hclGenerator: mssqlManagedInstanceHclGenerator,
  icon: mssqlManagedInstanceIcon,
};
