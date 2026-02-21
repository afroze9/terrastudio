import type { ResourceTypeRegistration } from '@terrastudio/types';
import { applicationInsightsSchema } from './schema.js';
import { applicationInsightsHclGenerator } from './hcl-generator.js';
import { applicationInsightsIcon } from './icon.js';

export const applicationInsightsRegistration: ResourceTypeRegistration = {
  schema: applicationInsightsSchema,
  nodeComponent: null,
  hclGenerator: applicationInsightsHclGenerator,
  icon: applicationInsightsIcon,
};
