import type { ResourceTypeRegistration } from '@terrastudio/types';
import { containerRegistrySchema } from './schema.js';
import { containerRegistryHclGenerator } from './hcl-generator.js';
import { containerRegistryIcon } from './icon.js';

export const containerRegistryRegistration: ResourceTypeRegistration = {
  schema: containerRegistrySchema,
  nodeComponent: null,
  hclGenerator: containerRegistryHclGenerator,
  icon: containerRegistryIcon,
};
