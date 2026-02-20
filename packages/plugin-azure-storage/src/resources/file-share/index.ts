import type { ResourceTypeRegistration } from '@terrastudio/types';
import { fileShareSchema } from './schema.js';
import { fileShareHclGenerator } from './hcl-generator.js';
import { fileShareIcon } from './icon.js';

export const fileShareRegistration: ResourceTypeRegistration = {
  schema: fileShareSchema,
  nodeComponent: null,
  hclGenerator: fileShareHclGenerator,
  icon: fileShareIcon,
};
