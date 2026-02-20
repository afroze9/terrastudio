import type { ResourceTypeRegistration } from '@terrastudio/types';
import { appServiceSchema } from './schema.js';
import { appServiceHclGenerator } from './hcl-generator.js';
import { appServiceIcon } from './icon.js';

export const appServiceRegistration: ResourceTypeRegistration = {
  schema: appServiceSchema,
  nodeComponent: null,
  hclGenerator: appServiceHclGenerator,
  icon: appServiceIcon,
};
