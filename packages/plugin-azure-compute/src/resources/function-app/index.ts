import type { ResourceTypeRegistration } from '@terrastudio/types';
import { functionAppSchema } from './schema.js';
import { functionAppHclGenerator } from './hcl-generator.js';
import { functionAppIcon } from './icon.js';

export const functionAppRegistration: ResourceTypeRegistration = {
  schema: functionAppSchema,
  nodeComponent: null,
  hclGenerator: functionAppHclGenerator,
  icon: functionAppIcon,
};
