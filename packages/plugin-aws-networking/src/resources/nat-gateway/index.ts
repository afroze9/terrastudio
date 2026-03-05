import type { ResourceTypeRegistration } from '@terrastudio/types';
import { natGatewaySchema } from './schema.js';
import { natGatewayHclGenerator } from './hcl-generator.js';
import { natGatewayIcon } from './icon.js';

export const natGatewayRegistration: ResourceTypeRegistration = {
  schema: natGatewaySchema,
  nodeComponent: null,
  hclGenerator: natGatewayHclGenerator,
  icon: natGatewayIcon,
};
