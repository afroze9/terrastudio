import type { ResourceTypeRegistration } from '@terrastudio/types';
import { genericAppSchema } from './schema.js';
import { createNoopGenerator } from '../../noop-hcl-generator.js';
import { genericAppIcon } from './icon.js';

export const genericAppRegistration: ResourceTypeRegistration = {
  schema: genericAppSchema,
  nodeComponent: null,
  hclGenerator: createNoopGenerator('_annotation/general/generic_app'),
  icon: genericAppIcon,
};
