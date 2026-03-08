import type { ResourceTypeRegistration } from '@terrastudio/types';
import { applicationGatewaySchema } from './schema.js';
import { applicationGatewayHclGenerator } from './hcl-generator.js';
import { applicationGatewayIcon } from './icon.js';

export const applicationGatewayRegistration: ResourceTypeRegistration = {
  schema: applicationGatewaySchema,
  nodeComponent: null,
  hclGenerator: applicationGatewayHclGenerator,
  icon: applicationGatewayIcon,
};
