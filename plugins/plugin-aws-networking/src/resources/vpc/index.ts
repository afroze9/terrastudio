import type { ResourceTypeRegistration } from '@terrastudio/types';
import { vpcSchema } from './schema.js';
import { vpcHclGenerator } from './hcl-generator.js';
import { vpcIcon } from './icon.js';

export const vpcRegistration: ResourceTypeRegistration = {
  schema: vpcSchema,
  nodeComponent: null,
  hclGenerator: vpcHclGenerator,
  icon: vpcIcon,
};
