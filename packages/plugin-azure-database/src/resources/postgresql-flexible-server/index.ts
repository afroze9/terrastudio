import type { ResourceTypeRegistration } from '@terrastudio/types';
import { postgresqlFlexibleServerSchema } from './schema.js';
import { postgresqlFlexibleServerHclGenerator } from './hcl-generator.js';
import { postgresqlFlexibleServerIcon } from './icon.js';

export const postgresqlFlexibleServerRegistration: ResourceTypeRegistration = {
  schema: postgresqlFlexibleServerSchema,
  nodeComponent: null,
  hclGenerator: postgresqlFlexibleServerHclGenerator,
  icon: postgresqlFlexibleServerIcon,
};
