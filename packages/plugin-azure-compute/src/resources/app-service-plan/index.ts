import type { ResourceTypeRegistration } from '@terrastudio/types';
import { appServicePlanSchema } from './schema.js';
import { appServicePlanHclGenerator } from './hcl-generator.js';

export const appServicePlanRegistration: ResourceTypeRegistration = {
  schema: appServicePlanSchema,
  nodeComponent: null,
  hclGenerator: appServicePlanHclGenerator,
};
