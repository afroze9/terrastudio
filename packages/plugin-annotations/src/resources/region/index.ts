import type { ResourceTypeRegistration } from '@terrastudio/types';
import { regionSchema } from './schema.js';
import { createNoopGenerator } from '../../noop-hcl-generator.js';
import { regionIcon } from './icon.js';

export const regionRegistration: ResourceTypeRegistration = {
  schema: regionSchema,
  nodeComponent: null,
  hclGenerator: createNoopGenerator('_annotation/general/region'),
  icon: regionIcon,
};
