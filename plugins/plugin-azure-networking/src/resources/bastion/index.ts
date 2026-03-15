import type { ResourceTypeRegistration } from '@terrastudio/types';
import { bastionSchema } from './schema.js';
import { bastionHclGenerator } from './hcl-generator.js';
import { bastionIcon } from './icon.js';

export const bastionRegistration: ResourceTypeRegistration = {
  schema: bastionSchema,
  nodeComponent: null,
  hclGenerator: bastionHclGenerator,
  icon: bastionIcon,
};
