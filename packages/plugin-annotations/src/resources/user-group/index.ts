import type { ResourceTypeRegistration } from '@terrastudio/types';
import { userGroupSchema } from './schema.js';
import { createNoopGenerator } from '../../noop-hcl-generator.js';
import { userGroupIcon } from './icon.js';

export const userGroupRegistration: ResourceTypeRegistration = {
  schema: userGroupSchema,
  nodeComponent: null,
  hclGenerator: createNoopGenerator('_annotation/general/user_group'),
  icon: userGroupIcon,
};
