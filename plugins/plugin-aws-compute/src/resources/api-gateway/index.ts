import type { ResourceTypeRegistration } from '@terrastudio/types';
import { apiGatewaySchema } from './schema.js';
import { apiGatewayHclGenerator } from './hcl-generator.js';
import { apiGatewayIcon } from './icon.js';

export const apiGatewayRegistration: ResourceTypeRegistration = {
  schema: apiGatewaySchema,
  nodeComponent: null,
  hclGenerator: apiGatewayHclGenerator,
  icon: apiGatewayIcon,
};
