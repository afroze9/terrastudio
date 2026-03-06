import type { ResourceTypeRegistration } from '@terrastudio/types';
import { sqsQueueSchema } from './schema.js';
import { sqsQueueHclGenerator } from './hcl-generator.js';
import { sqsQueueIcon } from './icon.js';

export const sqsQueueRegistration: ResourceTypeRegistration = {
  schema: sqsQueueSchema,
  nodeComponent: null,
  hclGenerator: sqsQueueHclGenerator,
  icon: sqsQueueIcon,
};
