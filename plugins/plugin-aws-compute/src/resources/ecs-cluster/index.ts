import type { ResourceTypeRegistration } from '@terrastudio/types';
import { ecsClusterSchema } from './schema.js';
import { ecsClusterHclGenerator } from './hcl-generator.js';
import { ecsClusterIcon } from './icon.js';

export const ecsClusterRegistration: ResourceTypeRegistration = {
  schema: ecsClusterSchema,
  nodeComponent: null,
  hclGenerator: ecsClusterHclGenerator,
  icon: ecsClusterIcon,
};
