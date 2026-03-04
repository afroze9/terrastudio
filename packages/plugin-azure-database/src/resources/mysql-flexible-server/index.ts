import type { ResourceTypeRegistration } from '@terrastudio/types';
import { mysqlFlexibleServerSchema } from './schema.js';
import { mysqlFlexibleServerHclGenerator } from './hcl-generator.js';
import { mysqlFlexibleServerIcon } from './icon.js';

export const mysqlFlexibleServerRegistration: ResourceTypeRegistration = {
  schema: mysqlFlexibleServerSchema,
  nodeComponent: null,
  hclGenerator: mysqlFlexibleServerHclGenerator,
  icon: mysqlFlexibleServerIcon,
};
