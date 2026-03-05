import type { ResourceTypeRegistration } from '@terrastudio/types';
import { albSchema } from './schema.js';
import { albHclGenerator } from './hcl-generator.js';
import { albIcon } from './icon.js';

export const albRegistration: ResourceTypeRegistration = {
  schema: albSchema,
  nodeComponent: null,
  hclGenerator: albHclGenerator,
  icon: albIcon,
};
