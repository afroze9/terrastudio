import type { ResourceTypeRegistration } from '@terrastudio/types';
import { roleAssignmentSchema } from './schema.js';
import { roleAssignmentHclGenerator } from './hcl-generator.js';
import { roleAssignmentIcon } from './icon.js';

export const roleAssignmentRegistration: ResourceTypeRegistration = {
  schema: roleAssignmentSchema,
  nodeComponent: null,
  hclGenerator: roleAssignmentHclGenerator,
  icon: roleAssignmentIcon,
};
