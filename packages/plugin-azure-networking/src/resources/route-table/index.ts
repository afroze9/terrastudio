import type { ResourceTypeRegistration } from '@terrastudio/types';
import { routeTableSchema } from './schema.js';
import { routeTableHclGenerator } from './hcl-generator.js';

export const routeTableRegistration: ResourceTypeRegistration = {
  schema: routeTableSchema,
  nodeComponent: null,
  hclGenerator: routeTableHclGenerator,
  icon: undefined,
};
