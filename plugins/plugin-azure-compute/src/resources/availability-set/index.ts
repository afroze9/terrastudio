import type { ResourceTypeRegistration } from '@terrastudio/types';
import { availabilitySetSchema } from './schema.js';
import { availabilitySetHclGenerator } from './hcl-generator.js';
import { availabilitySetIcon } from './icon.js';

export const availabilitySetRegistration: ResourceTypeRegistration = {
  schema: availabilitySetSchema,
  nodeComponent: null,
  hclGenerator: availabilitySetHclGenerator,
  icon: availabilitySetIcon,
};
