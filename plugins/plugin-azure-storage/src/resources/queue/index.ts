import type { ResourceTypeRegistration } from '@terrastudio/types';
import { queueSchema } from './schema.js';
import { queueHclGenerator } from './hcl-generator.js';
import { queueIcon } from './icon.js';

export const queueRegistration: ResourceTypeRegistration = {
  schema: queueSchema,
  nodeComponent: null,
  hclGenerator: queueHclGenerator,
  icon: queueIcon,
};
