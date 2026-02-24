import type { ResourceTypeRegistration } from '@terrastudio/types';
import { routeTableSchema } from './schema.js';
import { routeTableHclGenerator } from './hcl-generator.js';
import { routeTableIcon } from './icon.js';

export const routeTableRegistration: ResourceTypeRegistration = {
  schema: routeTableSchema,
  nodeComponent: null,
  hclGenerator: routeTableHclGenerator,
  icon: routeTableIcon,
};
