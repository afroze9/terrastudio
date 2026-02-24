import type { ResourceTypeRegistration } from '@terrastudio/types';
import { serviceBusQueueSchema } from './schema.js';
import { serviceBusQueueHclGenerator } from './hcl-generator.js';
import { serviceBusQueueIcon } from './icon.js';

export const serviceBusQueueRegistration: ResourceTypeRegistration = {
  schema: serviceBusQueueSchema,
  nodeComponent: null,
  hclGenerator: serviceBusQueueHclGenerator,
  icon: serviceBusQueueIcon,
};
