import type { ResourceTypeRegistration } from '@terrastudio/types';
import { iamRoleSchema } from './schema.js';
import { iamRoleHclGenerator } from './hcl-generator.js';
import { iamRoleIcon } from './icon.js';

export const iamRoleRegistration: ResourceTypeRegistration = {
  schema: iamRoleSchema,
  nodeComponent: null,
  hclGenerator: iamRoleHclGenerator,
  icon: iamRoleIcon,
};
