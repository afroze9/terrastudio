import type { ResourceTypeRegistration } from '@terrastudio/types';
import { dnsARecordSchema } from './schema.js';
import { dnsARecordHclGenerator } from './hcl-generator.js';
import { dnsARecordIcon } from './icon.js';

export const dnsARecordRegistration: ResourceTypeRegistration = {
  schema: dnsARecordSchema,
  nodeComponent: null,
  hclGenerator: dnsARecordHclGenerator,
  icon: dnsARecordIcon,
};
