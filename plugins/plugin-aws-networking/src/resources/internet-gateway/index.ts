import type { ResourceTypeRegistration } from '@terrastudio/types';
import { internetGatewaySchema } from './schema.js';
import { internetGatewayHclGenerator } from './hcl-generator.js';
import { internetGatewayIcon } from './icon.js';

export const internetGatewayRegistration: ResourceTypeRegistration = {
  schema: internetGatewaySchema,
  nodeComponent: null,
  hclGenerator: internetGatewayHclGenerator,
  icon: internetGatewayIcon,
};
