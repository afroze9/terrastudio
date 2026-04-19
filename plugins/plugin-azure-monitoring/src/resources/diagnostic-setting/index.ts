import type { ResourceTypeRegistration } from '@terrastudio/types';
import { diagnosticSettingSchema } from './schema.js';
import { diagnosticSettingHclGenerator } from './hcl-generator.js';
import { diagnosticSettingIcon } from './icon.js';

export const diagnosticSettingRegistration: ResourceTypeRegistration = {
  schema: diagnosticSettingSchema,
  nodeComponent: null,
  hclGenerator: diagnosticSettingHclGenerator,
  icon: diagnosticSettingIcon,
};
