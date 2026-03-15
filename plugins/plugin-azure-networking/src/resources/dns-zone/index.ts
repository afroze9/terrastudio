import type { ResourceTypeRegistration } from '@terrastudio/types';
import { dnsZoneSchema } from './schema.js';
import { dnsZoneHclGenerator } from './hcl-generator.js';
import { dnsZoneIcon } from './icon.js';

export const dnsZoneRegistration: ResourceTypeRegistration = {
  schema: dnsZoneSchema,
  nodeComponent: null,
  hclGenerator: dnsZoneHclGenerator,
  icon: dnsZoneIcon,
};
