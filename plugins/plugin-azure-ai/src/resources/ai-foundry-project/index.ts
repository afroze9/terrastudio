import type { ResourceTypeRegistration } from '@terrastudio/types';
import { aiFoundryProjectSchema } from './schema.js';
import { aiFoundryProjectHclGenerator } from './hcl-generator.js';
import { aiFoundryProjectIcon } from './icon.js';

export const aiFoundryProjectRegistration: ResourceTypeRegistration = {
  schema: aiFoundryProjectSchema,
  nodeComponent: null,
  hclGenerator: aiFoundryProjectHclGenerator,
  icon: aiFoundryProjectIcon,
};
