import type { ResourceTypeRegistration } from '@terrastudio/types';
import { clientSchema } from './schema.js';
import { createNoopGenerator } from '../../noop-hcl-generator.js';
import { clientIcon } from './icon.js';

export const clientRegistration: ResourceTypeRegistration = {
  schema: clientSchema,
  nodeComponent: null,
  hclGenerator: createNoopGenerator('_annotation/general/client'),
  icon: clientIcon,
};
