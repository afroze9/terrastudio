import type { ResourceTypeRegistration } from '@terrastudio/types';
import { efsSchema } from './schema.js';
import { efsHclGenerator } from './hcl-generator.js';
import { efsIcon } from './icon.js';

export const efsRegistration: ResourceTypeRegistration = {
  schema: efsSchema,
  nodeComponent: null,
  hclGenerator: efsHclGenerator,
  icon: efsIcon,
};
