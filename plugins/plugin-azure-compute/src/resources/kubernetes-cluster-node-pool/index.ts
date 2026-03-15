import type { ResourceTypeRegistration } from '@terrastudio/types';
import { kubernetesClusterNodePoolSchema } from './schema.js';
import { kubernetesClusterNodePoolHclGenerator } from './hcl-generator.js';
import { kubernetesClusterNodePoolIcon } from './icon.js';

export const kubernetesClusterNodePoolRegistration: ResourceTypeRegistration = {
  schema: kubernetesClusterNodePoolSchema,
  nodeComponent: null,
  hclGenerator: kubernetesClusterNodePoolHclGenerator,
  icon: kubernetesClusterNodePoolIcon,
};
