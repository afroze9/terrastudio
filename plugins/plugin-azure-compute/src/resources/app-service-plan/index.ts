import type { ResourceTypeRegistration } from '@terrastudio/types';
import { appServicePlanSchema } from './schema.js';
import { appServicePlanHclGenerator } from './hcl-generator.js';
import { appServicePlanIcon } from './icon.js';

export const appServicePlanRegistration: ResourceTypeRegistration = {
  schema: appServicePlanSchema,
  nodeComponent: null,
  hclGenerator: appServicePlanHclGenerator,
  icon: appServicePlanIcon,
};
