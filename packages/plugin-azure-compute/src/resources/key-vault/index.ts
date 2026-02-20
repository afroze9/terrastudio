import type { ResourceTypeRegistration } from '@terrastudio/types';
import { keyVaultSchema } from './schema.js';
import { keyVaultHclGenerator } from './hcl-generator.js';
import { keyVaultIcon } from './icon.js';

export const keyVaultRegistration: ResourceTypeRegistration = {
  schema: keyVaultSchema,
  nodeComponent: null,
  hclGenerator: keyVaultHclGenerator,
  icon: keyVaultIcon,
};
