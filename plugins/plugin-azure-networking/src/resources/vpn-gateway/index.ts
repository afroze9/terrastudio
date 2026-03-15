import type { ResourceTypeRegistration } from '@terrastudio/types';
import { vpnGatewaySchema } from './schema.js';
import { vpnGatewayHclGenerator } from './hcl-generator.js';
import { vpnGatewayIcon } from './icon.js';

export const vpnGatewayRegistration: ResourceTypeRegistration = {
  schema: vpnGatewaySchema,
  nodeComponent: null,
  hclGenerator: vpnGatewayHclGenerator,
  icon: vpnGatewayIcon,
};
