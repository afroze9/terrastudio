import type { ResourceTypeRegistration } from '@terrastudio/types';
import { containerAppEnvironmentSchema } from './schema.js';
import { containerAppEnvironmentHclGenerator } from './hcl-generator.js';
import { containerAppEnvironmentIcon } from './icon.js';

export const containerAppEnvironmentRegistration: ResourceTypeRegistration = {
  schema: containerAppEnvironmentSchema,
  nodeComponent: null,
  hclGenerator: containerAppEnvironmentHclGenerator,
  icon: containerAppEnvironmentIcon,
};
