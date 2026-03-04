import type { ResourceTypeRegistration } from '@terrastudio/types';
import { containerGroupSchema } from './schema.js';
import { containerGroupHclGenerator } from './hcl-generator.js';
import { containerGroupIcon } from './icon.js';

export const containerGroupRegistration: ResourceTypeRegistration = {
  schema: containerGroupSchema,
  nodeComponent: null,
  hclGenerator: containerGroupHclGenerator,
  icon: containerGroupIcon,
};
