import type { ResourceTypeRegistration } from '@terrastudio/types';
import { resourceGroupSchema } from './schema.js';
import { resourceGroupHclGenerator } from './hcl-generator.js';
import { resourceGroupIcon } from './icon.js';

export const resourceGroupRegistration: ResourceTypeRegistration = {
  schema: resourceGroupSchema,
  nodeComponent: null,
  hclGenerator: resourceGroupHclGenerator,
  icon: resourceGroupIcon,
};
