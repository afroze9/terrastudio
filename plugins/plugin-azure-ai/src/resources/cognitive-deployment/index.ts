import type { ResourceTypeRegistration } from '@terrastudio/types';
import { cognitiveDeploymentSchema } from './schema.js';
import { cognitiveDeploymentHclGenerator } from './hcl-generator.js';
import { cognitiveDeploymentIcon } from './icon.js';

export const cognitiveDeploymentRegistration: ResourceTypeRegistration = {
  schema: cognitiveDeploymentSchema,
  nodeComponent: null,
  hclGenerator: cognitiveDeploymentHclGenerator,
  icon: cognitiveDeploymentIcon,
};
