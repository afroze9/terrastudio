import type { ResourceTypeRegistration } from '@terrastudio/types';
import { privateDnsZoneVnetLinkSchema } from './schema.js';
import { privateDnsZoneVnetLinkHclGenerator } from './hcl-generator.js';
import { privateDnsZoneVnetLinkIcon } from './icon.js';

export const privateDnsZoneVnetLinkRegistration: ResourceTypeRegistration = {
  schema: privateDnsZoneVnetLinkSchema,
  nodeComponent: null,
  hclGenerator: privateDnsZoneVnetLinkHclGenerator,
  icon: privateDnsZoneVnetLinkIcon,
};
