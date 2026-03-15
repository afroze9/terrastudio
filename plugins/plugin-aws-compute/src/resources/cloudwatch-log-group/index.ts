import type { ResourceTypeRegistration } from '@terrastudio/types';
import { cloudwatchLogGroupSchema } from './schema.js';
import { cloudwatchLogGroupHclGenerator } from './hcl-generator.js';
import { cloudwatchLogGroupIcon } from './icon.js';

export const cloudwatchLogGroupRegistration: ResourceTypeRegistration = {
  schema: cloudwatchLogGroupSchema,
  nodeComponent: null,
  hclGenerator: cloudwatchLogGroupHclGenerator,
  icon: cloudwatchLogGroupIcon,
};
