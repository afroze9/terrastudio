import type { ResourceTypeRegistration } from '@terrastudio/types';
import { cognitiveAccountSchema } from './schema.js';
import { cognitiveAccountHclGenerator } from './hcl-generator.js';
import { cognitiveAccountIcon } from './icon.js';

export const cognitiveAccountRegistration: ResourceTypeRegistration = {
  schema: cognitiveAccountSchema,
  nodeComponent: null,
  hclGenerator: cognitiveAccountHclGenerator,
  icon: cognitiveAccountIcon,
};
