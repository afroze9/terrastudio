import type { ResourceTypeRegistration } from '@terrastudio/types';
import { userAssignedIdentitySchema } from './schema.js';
import { userAssignedIdentityHclGenerator } from './hcl-generator.js';
import { userAssignedIdentityIcon } from './icon.js';

export const userAssignedIdentityRegistration: ResourceTypeRegistration = {
  schema: userAssignedIdentitySchema,
  nodeComponent: null,
  hclGenerator: userAssignedIdentityHclGenerator,
  icon: userAssignedIdentityIcon,
};
