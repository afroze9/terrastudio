import type { ResourceTypeRegistration } from '@terrastudio/types';
import { appServiceSchema } from './schema.js';
import { appServiceHclGenerator } from './hcl-generator.js';

export const appServiceRegistration: ResourceTypeRegistration = {
  schema: appServiceSchema,
  nodeComponent: null,
  hclGenerator: appServiceHclGenerator,
};
