import type { ResourceTypeRegistration } from '@terrastudio/types';
import { snsTopicSchema } from './schema.js';
import { snsTopicHclGenerator } from './hcl-generator.js';
import { snsTopicIcon } from './icon.js';

export const snsTopicRegistration: ResourceTypeRegistration = {
  schema: snsTopicSchema,
  nodeComponent: null,
  hclGenerator: snsTopicHclGenerator,
  icon: snsTopicIcon,
};
