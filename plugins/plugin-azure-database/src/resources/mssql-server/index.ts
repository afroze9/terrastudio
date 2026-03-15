import type { ResourceTypeRegistration } from '@terrastudio/types';
import { mssqlServerSchema } from './schema.js';
import { mssqlServerHclGenerator } from './hcl-generator.js';
import { mssqlServerIcon } from './icon.js';

export const mssqlServerRegistration: ResourceTypeRegistration = {
  schema: mssqlServerSchema,
  nodeComponent: null,
  hclGenerator: mssqlServerHclGenerator,
  icon: mssqlServerIcon,
};
