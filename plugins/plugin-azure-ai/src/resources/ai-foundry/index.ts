import type { ResourceTypeRegistration } from '@terrastudio/types';
import { aiFoundrySchema } from './schema.js';
import { aiFoundryHclGenerator } from './hcl-generator.js';
import { aiFoundryIcon } from './icon.js';

export const aiFoundryRegistration: ResourceTypeRegistration = {
  schema: aiFoundrySchema,
  nodeComponent: null,
  hclGenerator: aiFoundryHclGenerator,
  icon: aiFoundryIcon,
};
