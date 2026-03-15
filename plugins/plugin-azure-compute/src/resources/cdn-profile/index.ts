import type { ResourceTypeRegistration } from '@terrastudio/types';
import { cdnProfileSchema } from './schema.js';
import { cdnProfileHclGenerator } from './hcl-generator.js';
import { cdnProfileIcon } from './icon.js';

export const cdnProfileRegistration: ResourceTypeRegistration = {
  schema: cdnProfileSchema,
  nodeComponent: null,
  hclGenerator: cdnProfileHclGenerator,
  icon: cdnProfileIcon,
};
