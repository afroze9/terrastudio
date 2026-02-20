import type { ResourceTypeRegistration } from '@terrastudio/types';
import { subscriptionSchema } from './schema.js';
import { subscriptionHclGenerator } from './hcl-generator.js';
import { subscriptionIcon } from './icon.js';

export const subscriptionRegistration: ResourceTypeRegistration = {
  schema: subscriptionSchema,
  nodeComponent: null,
  hclGenerator: subscriptionHclGenerator,
  icon: subscriptionIcon,
};
