import type { ResourceTypeRegistration } from '@terrastudio/types';
import { keyVaultKeySchema } from './schema.js';
import { keyVaultKeyHclGenerator } from './hcl-generator.js';
import { keyVaultKeyIcon } from './icon.js';

export const keyVaultKeyRegistration: ResourceTypeRegistration = {
  schema: keyVaultKeySchema,
  nodeComponent: null,
  hclGenerator: keyVaultKeyHclGenerator,
  icon: keyVaultKeyIcon,
};
