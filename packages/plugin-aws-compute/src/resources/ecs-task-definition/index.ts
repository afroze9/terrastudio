import type { ResourceTypeRegistration } from '@terrastudio/types';
import { ecsTaskDefinitionSchema } from './schema.js';
import { ecsTaskDefinitionHclGenerator } from './hcl-generator.js';
import { ecsTaskDefinitionIcon } from './icon.js';

export const ecsTaskDefinitionRegistration: ResourceTypeRegistration = {
  schema: ecsTaskDefinitionSchema,
  nodeComponent: null,
  hclGenerator: ecsTaskDefinitionHclGenerator,
  icon: ecsTaskDefinitionIcon,
};
