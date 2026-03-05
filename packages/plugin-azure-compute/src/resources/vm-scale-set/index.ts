import type { ResourceTypeRegistration } from '@terrastudio/types';
import { vmScaleSetSchema } from './schema.js';
import { vmScaleSetHclGenerator } from './hcl-generator.js';
import { vmScaleSetIcon } from './icon.js';

export const vmScaleSetRegistration: ResourceTypeRegistration = {
  schema: vmScaleSetSchema,
  nodeComponent: null,
  hclGenerator: vmScaleSetHclGenerator,
  icon: vmScaleSetIcon,
};
