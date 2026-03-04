import type { ResourceTypeRegistration } from '@terrastudio/types';
import { eventhubSchema } from './schema.js';
import { eventhubHclGenerator } from './hcl-generator.js';
import { eventhubIcon } from './icon.js';

export const eventhubRegistration: ResourceTypeRegistration = {
  schema: eventhubSchema,
  nodeComponent: null,
  hclGenerator: eventhubHclGenerator,
  icon: eventhubIcon,
};
