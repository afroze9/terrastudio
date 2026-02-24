import type { ResourceTypeRegistration } from '@terrastudio/types';
import { serviceBusNamespaceSchema } from './schema.js';
import { serviceBusNamespaceHclGenerator } from './hcl-generator.js';

export const serviceBusNamespaceRegistration: ResourceTypeRegistration = {
  schema: serviceBusNamespaceSchema,
  nodeComponent: null,
  hclGenerator: serviceBusNamespaceHclGenerator,
  icon: undefined,
};
