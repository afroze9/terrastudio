import type { ResourceTypeRegistration } from '@terrastudio/types';
import { ecrSchema } from './schema.js';
import { ecrHclGenerator } from './hcl-generator.js';
import { ecrIcon } from './icon.js';

export const ecrRegistration: ResourceTypeRegistration = {
  schema: ecrSchema,
  nodeComponent: null,
  hclGenerator: ecrHclGenerator,
  icon: ecrIcon,
};
