import type { ResourceTypeRegistration } from '@terrastudio/types';
import { browserSchema } from './schema.js';
import { createNoopGenerator } from '../../noop-hcl-generator.js';
import { browserIcon } from './icon.js';

export const browserRegistration: ResourceTypeRegistration = {
  schema: browserSchema,
  nodeComponent: null,
  hclGenerator: createNoopGenerator('_annotation/general/browser'),
  icon: browserIcon,
};
