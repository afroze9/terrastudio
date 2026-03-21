import type { ResourceTypeRegistration } from '@terrastudio/types';
import { userSchema } from './schema.js';
import { createNoopGenerator } from '../../noop-hcl-generator.js';
import { userIcon } from './icon.js';

export const userRegistration: ResourceTypeRegistration = {
  schema: userSchema,
  nodeComponent: null,
  hclGenerator: createNoopGenerator('_annotation/general/user'),
  icon: userIcon,
};
