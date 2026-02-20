import type { ResourceTypeRegistration } from '@terrastudio/types';
import { tableSchema } from './schema.js';
import { tableHclGenerator } from './hcl-generator.js';
import { tableIcon } from './icon.js';

export const tableRegistration: ResourceTypeRegistration = {
  schema: tableSchema,
  nodeComponent: null,
  hclGenerator: tableHclGenerator,
  icon: tableIcon,
};
