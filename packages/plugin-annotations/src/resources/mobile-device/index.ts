import type { ResourceTypeRegistration } from '@terrastudio/types';
import { mobileDeviceSchema } from './schema.js';
import { createNoopGenerator } from '../../noop-hcl-generator.js';
import { mobileDeviceIcon } from './icon.js';

export const mobileDeviceRegistration: ResourceTypeRegistration = {
  schema: mobileDeviceSchema,
  nodeComponent: null,
  hclGenerator: createNoopGenerator('_annotation/general/mobile_device'),
  icon: mobileDeviceIcon,
};
