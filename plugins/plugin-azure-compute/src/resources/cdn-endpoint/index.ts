import type { ResourceTypeRegistration } from '@terrastudio/types';
import { cdnEndpointSchema } from './schema.js';
import { cdnEndpointHclGenerator } from './hcl-generator.js';
import { cdnEndpointIcon } from './icon.js';

export const cdnEndpointRegistration: ResourceTypeRegistration = {
  schema: cdnEndpointSchema,
  nodeComponent: null,
  hclGenerator: cdnEndpointHclGenerator,
  icon: cdnEndpointIcon,
};
