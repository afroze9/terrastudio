import type { ResourceTypeRegistration } from '@terrastudio/types';
import { frontdoorProfileSchema } from './schema.js';
import { frontdoorProfileHclGenerator } from './hcl-generator.js';
import { frontdoorProfileIcon } from './icon.js';

export const frontdoorProfileRegistration: ResourceTypeRegistration = {
  schema: frontdoorProfileSchema,
  nodeComponent: null,
  hclGenerator: frontdoorProfileHclGenerator,
  icon: frontdoorProfileIcon,
};
