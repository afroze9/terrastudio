import type { ResourceTypeRegistration } from '@terrastudio/types';
import { storageAccountSchema } from './schema.js';
import { storageAccountHclGenerator } from './hcl-generator.js';
import { storageAccountIcon } from './icon.js';

export const storageAccountRegistration: ResourceTypeRegistration = {
  schema: storageAccountSchema,
  nodeComponent: null,
  hclGenerator: storageAccountHclGenerator,
  icon: storageAccountIcon,
};
