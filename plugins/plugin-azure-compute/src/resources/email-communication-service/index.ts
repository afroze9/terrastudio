import type { ResourceTypeRegistration } from '@terrastudio/types';
import { emailCommunicationServiceSchema } from './schema.js';
import { emailCommunicationServiceHclGenerator } from './hcl-generator.js';
import { emailCommunicationServiceIcon } from './icon.js';

export const emailCommunicationServiceRegistration: ResourceTypeRegistration = {
  schema: emailCommunicationServiceSchema,
  nodeComponent: null,
  hclGenerator: emailCommunicationServiceHclGenerator,
  icon: emailCommunicationServiceIcon,
};
