import type { ResourceTypeRegistration } from '@terrastudio/types';
import { botServiceSchema } from './schema.js';
import { botServiceHclGenerator } from './hcl-generator.js';
import { botServiceIcon } from './icon.js';

export const botServiceRegistration: ResourceTypeRegistration = {
  schema: botServiceSchema,
  nodeComponent: null,
  hclGenerator: botServiceHclGenerator,
  icon: botServiceIcon,
};
