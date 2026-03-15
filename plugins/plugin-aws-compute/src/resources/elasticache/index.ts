import type { ResourceTypeRegistration } from '@terrastudio/types';
import { elasticacheSchema } from './schema.js';
import { elasticacheHclGenerator } from './hcl-generator.js';
import { elasticacheIcon } from './icon.js';

export const elasticacheRegistration: ResourceTypeRegistration = {
  schema: elasticacheSchema,
  nodeComponent: null,
  hclGenerator: elasticacheHclGenerator,
  icon: elasticacheIcon,
};
