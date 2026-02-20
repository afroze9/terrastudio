import type { ResourceTypeRegistration } from '@terrastudio/types';
import { blobContainerSchema } from './schema.js';
import { blobContainerHclGenerator } from './hcl-generator.js';
import { blobContainerIcon } from './icon.js';

export const blobContainerRegistration: ResourceTypeRegistration = {
  schema: blobContainerSchema,
  nodeComponent: null,
  hclGenerator: blobContainerHclGenerator,
  icon: blobContainerIcon,
};
