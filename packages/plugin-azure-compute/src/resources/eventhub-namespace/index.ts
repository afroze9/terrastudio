import type { ResourceTypeRegistration } from '@terrastudio/types';
import { eventhubNamespaceSchema } from './schema.js';
import { eventhubNamespaceHclGenerator } from './hcl-generator.js';
import { eventhubNamespaceIcon } from './icon.js';

export const eventhubNamespaceRegistration: ResourceTypeRegistration = {
  schema: eventhubNamespaceSchema,
  nodeComponent: null,
  hclGenerator: eventhubNamespaceHclGenerator,
  icon: eventhubNamespaceIcon,
};
