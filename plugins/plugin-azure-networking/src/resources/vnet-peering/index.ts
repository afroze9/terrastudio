import type { ResourceTypeRegistration } from '@terrastudio/types';
import { vnetPeeringSchema } from './schema.js';
import { vnetPeeringHclGenerator } from './hcl-generator.js';
import { vnetPeeringIcon } from './icon.js';

export const vnetPeeringRegistration: ResourceTypeRegistration = {
  schema: vnetPeeringSchema,
  nodeComponent: null,
  hclGenerator: vnetPeeringHclGenerator,
  icon: vnetPeeringIcon,
};
