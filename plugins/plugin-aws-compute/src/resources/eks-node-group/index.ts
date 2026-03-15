import type { ResourceTypeRegistration } from '@terrastudio/types';
import { eksNodeGroupSchema } from './schema.js';
import { eksNodeGroupHclGenerator } from './hcl-generator.js';
import { eksNodeGroupIcon } from './icon.js';

export const eksNodeGroupRegistration: ResourceTypeRegistration = {
  schema: eksNodeGroupSchema,
  nodeComponent: null,
  hclGenerator: eksNodeGroupHclGenerator,
  icon: eksNodeGroupIcon,
};
