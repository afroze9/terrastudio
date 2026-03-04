import type { ResourceTypeRegistration } from '@terrastudio/types';
import { loadBalancerSchema } from './schema.js';
import { loadBalancerHclGenerator } from './hcl-generator.js';
import { loadBalancerIcon } from './icon.js';

export const loadBalancerRegistration: ResourceTypeRegistration = {
  schema: loadBalancerSchema,
  nodeComponent: null,
  hclGenerator: loadBalancerHclGenerator,
  icon: loadBalancerIcon,
};
