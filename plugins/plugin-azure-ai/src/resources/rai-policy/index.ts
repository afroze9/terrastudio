import type { ResourceTypeRegistration } from '@terrastudio/types';
import { raiPolicySchema } from './schema.js';
import { raiPolicyHclGenerator } from './hcl-generator.js';
import { raiPolicyIcon } from './icon.js';

export const raiPolicyRegistration: ResourceTypeRegistration = {
  schema: raiPolicySchema,
  nodeComponent: null,
  hclGenerator: raiPolicyHclGenerator,
  icon: raiPolicyIcon,
};
