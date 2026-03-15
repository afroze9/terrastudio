import type { ResourceTypeRegistration } from '@terrastudio/types';
import { privateDnsZoneSchema } from './schema.js';
import { privateDnsZoneHclGenerator } from './hcl-generator.js';
import { privateDnsZoneIcon } from './icon.js';

export const privateDnsZoneRegistration: ResourceTypeRegistration = {
  schema: privateDnsZoneSchema,
  nodeComponent: null,
  hclGenerator: privateDnsZoneHclGenerator,
  icon: privateDnsZoneIcon,
};
