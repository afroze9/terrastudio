import type { ResourceTypeRegistration } from '@terrastudio/types';
import { actionGroupSchema } from './schema.js';
import { actionGroupHclGenerator } from './hcl-generator.js';
import { actionGroupIcon } from './icon.js';

export const actionGroupRegistration: ResourceTypeRegistration = {
  schema: actionGroupSchema,
  nodeComponent: null,
  hclGenerator: actionGroupHclGenerator,
  icon: actionGroupIcon,
};
