import type { ResourceTypeRegistration } from '@terrastudio/types';
import { searchServiceSchema } from './schema.js';
import { searchServiceHclGenerator } from './hcl-generator.js';
import { searchServiceIcon } from './icon.js';

export const searchServiceRegistration: ResourceTypeRegistration = {
  schema: searchServiceSchema,
  nodeComponent: null,
  hclGenerator: searchServiceHclGenerator,
  icon: searchServiceIcon,
};
