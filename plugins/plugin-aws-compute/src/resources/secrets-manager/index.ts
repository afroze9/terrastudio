import type { ResourceTypeRegistration } from '@terrastudio/types';
import { secretsManagerSchema } from './schema.js';
import { secretsManagerHclGenerator } from './hcl-generator.js';
import { secretsManagerIcon } from './icon.js';

export const secretsManagerRegistration: ResourceTypeRegistration = {
  schema: secretsManagerSchema,
  nodeComponent: null,
  hclGenerator: secretsManagerHclGenerator,
  icon: secretsManagerIcon,
};
