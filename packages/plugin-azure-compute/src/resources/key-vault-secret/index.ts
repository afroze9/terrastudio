import type { ResourceTypeRegistration } from '@terrastudio/types';
import { keyVaultSecretSchema } from './schema.js';
import { keyVaultSecretHclGenerator } from './hcl-generator.js';
import { keyVaultSecretIcon } from './icon.js';

export const keyVaultSecretRegistration: ResourceTypeRegistration = {
  schema: keyVaultSecretSchema,
  nodeComponent: null,
  hclGenerator: keyVaultSecretHclGenerator,
  icon: keyVaultSecretIcon,
};
