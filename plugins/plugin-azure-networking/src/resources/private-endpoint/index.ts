import type { ResourceTypeRegistration } from '@terrastudio/types';
import { privateEndpointSchema } from './schema.js';
import { privateEndpointHclGenerator } from './hcl-generator.js';
import { privateEndpointIcon } from './icon.js';

export const privateEndpointRegistration: ResourceTypeRegistration = {
  schema: privateEndpointSchema,
  nodeComponent: null,
  hclGenerator: privateEndpointHclGenerator,
  icon: privateEndpointIcon,
};
