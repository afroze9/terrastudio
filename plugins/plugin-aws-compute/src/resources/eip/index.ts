import type { ResourceTypeRegistration } from '@terrastudio/types';
import { eipSchema } from './schema.js';
import { eipHclGenerator } from './hcl-generator.js';
import { eipIcon } from './icon.js';

export const eipRegistration: ResourceTypeRegistration = {
  schema: eipSchema,
  nodeComponent: null,
  hclGenerator: eipHclGenerator,
  icon: eipIcon,
};
