import type { ResourceTypeRegistration } from '@terrastudio/types';
import { serverSchema } from './schema.js';
import { createNoopGenerator } from '../../noop-hcl-generator.js';
import { serverIcon } from './icon.js';

export const serverRegistration: ResourceTypeRegistration = {
  schema: serverSchema,
  nodeComponent: null,
  hclGenerator: createNoopGenerator('_annotation/general/server'),
  icon: serverIcon,
};
