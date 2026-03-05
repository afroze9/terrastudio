import type { ResourceTypeRegistration } from '@terrastudio/types';
import { securityGroupSchema } from './schema.js';
import { securityGroupHclGenerator } from './hcl-generator.js';
import { securityGroupIcon } from './icon.js';

export const securityGroupRegistration: ResourceTypeRegistration = {
  schema: securityGroupSchema,
  nodeComponent: null,
  hclGenerator: securityGroupHclGenerator,
  icon: securityGroupIcon,
};
