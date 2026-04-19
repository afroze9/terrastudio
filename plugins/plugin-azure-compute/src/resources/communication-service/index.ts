import type { ResourceTypeRegistration } from '@terrastudio/types';
import { communicationServiceSchema } from './schema.js';
import { communicationServiceHclGenerator } from './hcl-generator.js';
import { communicationServiceIcon } from './icon.js';

export const communicationServiceRegistration: ResourceTypeRegistration = {
  schema: communicationServiceSchema,
  nodeComponent: null,
  hclGenerator: communicationServiceHclGenerator,
  icon: communicationServiceIcon,
};
