import type { ResourceTypeRegistration } from '@terrastudio/types';
import { bastionSchema } from './schema.js';
import { bastionHclGenerator } from './hcl-generator.js';

export const bastionRegistration: ResourceTypeRegistration = {
  schema: bastionSchema,
  nodeComponent: null,
  hclGenerator: bastionHclGenerator,
  icon: undefined,
};
