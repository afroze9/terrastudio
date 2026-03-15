import type { ResourceTypeRegistration } from '@terrastudio/types';
import { routeSchema } from './schema.js';
import { routeHclGenerator } from './hcl-generator.js';
import { routeIcon } from './icon.js';

export const routeRegistration: ResourceTypeRegistration = {
  schema: routeSchema,
  nodeComponent: null,
  hclGenerator: routeHclGenerator,
  icon: routeIcon,
};
