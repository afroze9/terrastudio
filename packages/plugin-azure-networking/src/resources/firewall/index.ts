import type { ResourceTypeRegistration } from '@terrastudio/types';
import { firewallSchema } from './schema.js';
import { firewallHclGenerator } from './hcl-generator.js';
import { firewallIcon } from './icon.js';

export const firewallRegistration: ResourceTypeRegistration = {
  schema: firewallSchema,
  nodeComponent: null,
  hclGenerator: firewallHclGenerator,
  icon: firewallIcon,
};
