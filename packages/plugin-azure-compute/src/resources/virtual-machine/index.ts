import type { ResourceTypeRegistration } from '@terrastudio/types';
import { vmSchema } from './schema.js';
import { vmHclGenerator } from './hcl-generator.js';
import { vmIcon } from './icon.js';

export const vmRegistration: ResourceTypeRegistration = {
  schema: vmSchema,
  nodeComponent: null,
  hclGenerator: vmHclGenerator,
  icon: vmIcon,
};
