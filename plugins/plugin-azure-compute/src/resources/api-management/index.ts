import type { ResourceTypeRegistration } from '@terrastudio/types';
import { apiManagementSchema } from './schema.js';
import { apiManagementHclGenerator } from './hcl-generator.js';
import { apiManagementIcon } from './icon.js';

export const apiManagementRegistration: ResourceTypeRegistration = {
  schema: apiManagementSchema,
  nodeComponent: null,
  hclGenerator: apiManagementHclGenerator,
  icon: apiManagementIcon,
};
