import type { ResourceTypeRegistration } from '@terrastudio/types';
import { containerAppSchema } from './schema.js';
import { containerAppHclGenerator } from './hcl-generator.js';
import { containerAppIcon } from './icon.js';

export const containerAppRegistration: ResourceTypeRegistration = {
  schema: containerAppSchema,
  nodeComponent: null,
  hclGenerator: containerAppHclGenerator,
  icon: containerAppIcon,
};
