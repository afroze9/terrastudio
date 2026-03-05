import type { ResourceTypeRegistration } from '@terrastudio/types';
import { ec2InstanceSchema } from './schema.js';
import { ec2InstanceHclGenerator } from './hcl-generator.js';
import { ec2InstanceIcon } from './icon.js';

export const ec2InstanceRegistration: ResourceTypeRegistration = {
  schema: ec2InstanceSchema,
  nodeComponent: null,
  hclGenerator: ec2InstanceHclGenerator,
  icon: ec2InstanceIcon,
};
