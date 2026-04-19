import type { ResourceTypeRegistration } from '@terrastudio/types';
import { appConfigurationSchema } from './schema.js';
import { appConfigurationHclGenerator } from './hcl-generator.js';
import { appConfigurationIcon } from './icon.js';

export const appConfigurationRegistration: ResourceTypeRegistration = {
  schema: appConfigurationSchema,
  nodeComponent: null,
  hclGenerator: appConfigurationHclGenerator,
  icon: appConfigurationIcon,
};
