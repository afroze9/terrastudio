import type { ResourceTypeRegistration } from '@terrastudio/types';
import { serviceBusTopicSchema } from './schema.js';
import { serviceBusTopicHclGenerator } from './hcl-generator.js';
import { serviceBusTopicIcon } from './icon.js';

export const serviceBusTopicRegistration: ResourceTypeRegistration = {
  schema: serviceBusTopicSchema,
  nodeComponent: null,
  hclGenerator: serviceBusTopicHclGenerator,
  icon: serviceBusTopicIcon,
};
