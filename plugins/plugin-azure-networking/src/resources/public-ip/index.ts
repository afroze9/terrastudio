import type { ResourceTypeRegistration } from '@terrastudio/types';
import { publicIpSchema } from './schema.js';
import { publicIpHclGenerator } from './hcl-generator.js';
import { publicIpIcon } from './icon.js';

export const publicIpRegistration: ResourceTypeRegistration = {
  schema: publicIpSchema,
  nodeComponent: null,
  hclGenerator: publicIpHclGenerator,
  icon: publicIpIcon,
};
