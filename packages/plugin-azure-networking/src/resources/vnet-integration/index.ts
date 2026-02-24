import type { ResourceTypeRegistration } from '@terrastudio/types';
import { vnetIntegrationSchema } from './schema.js';
import { vnetIntegrationHclGenerator } from './hcl-generator.js';
import { vnetIntegrationIcon } from './icon.js';

export const vnetIntegrationRegistration: ResourceTypeRegistration = {
  schema: vnetIntegrationSchema,
  nodeComponent: null,
  hclGenerator: vnetIntegrationHclGenerator,
  icon: vnetIntegrationIcon,
};
