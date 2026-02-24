import type { ResourceTypeRegistration } from '@terrastudio/types';
import { redisCacheSchema } from './schema.js';
import { redisCacheHclGenerator } from './hcl-generator.js';

export const redisCacheRegistration: ResourceTypeRegistration = {
  schema: redisCacheSchema,
  nodeComponent: null,
  hclGenerator: redisCacheHclGenerator,
  icon: undefined,
};
