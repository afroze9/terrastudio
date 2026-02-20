import type { ResourceTypeRegistration } from '@terrastudio/types';
import { storageAccountSchema } from './schema.js';
import { storageAccountHclGenerator } from './hcl-generator.js';

export const storageAccountRegistration: ResourceTypeRegistration = {
  schema: storageAccountSchema,
  nodeComponent: null,
  hclGenerator: storageAccountHclGenerator,
};
