import type { ResourceTypeRegistration } from '@terrastudio/types';
import { aiServicesSchema } from './schema.js';
import { aiServicesHclGenerator } from './hcl-generator.js';
import { aiServicesIcon } from './icon.js';

export const aiServicesRegistration: ResourceTypeRegistration = {
  schema: aiServicesSchema,
  nodeComponent: null,
  hclGenerator: aiServicesHclGenerator,
  icon: aiServicesIcon,
};
