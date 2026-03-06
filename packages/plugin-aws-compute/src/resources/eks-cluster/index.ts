import type { ResourceTypeRegistration } from '@terrastudio/types';
import { eksClusterSchema } from './schema.js';
import { eksClusterHclGenerator } from './hcl-generator.js';
import { eksClusterIcon } from './icon.js';

export const eksClusterRegistration: ResourceTypeRegistration = {
  schema: eksClusterSchema,
  nodeComponent: null,
  hclGenerator: eksClusterHclGenerator,
  icon: eksClusterIcon,
};
