import type { ResourceTypeRegistration } from '@terrastudio/types';
import { subnetSchema } from './schema.js';
import { subnetHclGenerator } from './hcl-generator.js';
import { subnetIcon } from './icon.js';

export const subnetRegistration: ResourceTypeRegistration = {
  schema: subnetSchema,
  nodeComponent: null,
  hclGenerator: subnetHclGenerator,
  icon: subnetIcon,
};
