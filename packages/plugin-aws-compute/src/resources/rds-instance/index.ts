import type { ResourceTypeRegistration } from '@terrastudio/types';
import { rdsInstanceSchema } from './schema.js';
import { rdsInstanceHclGenerator } from './hcl-generator.js';
import { rdsInstanceIcon } from './icon.js';

export const rdsInstanceRegistration: ResourceTypeRegistration = {
  schema: rdsInstanceSchema,
  nodeComponent: null,
  hclGenerator: rdsInstanceHclGenerator,
  icon: rdsInstanceIcon,
};
