import type { ResourceTypeRegistration } from '@terrastudio/types';
import { ecsServiceSchema } from './schema.js';
import { ecsServiceHclGenerator } from './hcl-generator.js';
import { ecsServiceIcon } from './icon.js';

export const ecsServiceRegistration: ResourceTypeRegistration = {
  schema: ecsServiceSchema,
  nodeComponent: null,
  hclGenerator: ecsServiceHclGenerator,
  icon: ecsServiceIcon,
};
