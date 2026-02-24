import type { ResourceTypeRegistration } from '@terrastudio/types';
import { cosmosdbAccountSchema } from './schema.js';
import { cosmosdbAccountHclGenerator } from './hcl-generator.js';

export const cosmosdbAccountRegistration: ResourceTypeRegistration = {
  schema: cosmosdbAccountSchema,
  nodeComponent: null,
  hclGenerator: cosmosdbAccountHclGenerator,
  icon: undefined,
};
