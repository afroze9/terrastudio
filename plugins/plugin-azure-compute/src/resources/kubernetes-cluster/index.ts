import type { ResourceTypeRegistration } from '@terrastudio/types';
import { kubernetesClusterSchema } from './schema.js';
import { kubernetesClusterHclGenerator } from './hcl-generator.js';
import { kubernetesClusterIcon } from './icon.js';

export const kubernetesClusterRegistration: ResourceTypeRegistration = {
  schema: kubernetesClusterSchema,
  nodeComponent: null,
  hclGenerator: kubernetesClusterHclGenerator,
  icon: kubernetesClusterIcon,
};
