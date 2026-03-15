import type { ResourceTypeRegistration } from '@terrastudio/types';
import { vnetSchema } from './schema.js';
import { vnetHclGenerator } from './hcl-generator.js';
import { vnetIcon } from './icon.js';

export const vnetRegistration: ResourceTypeRegistration = {
  schema: vnetSchema,
  nodeComponent: null, // Svelte component — registered at app level via Vite
  hclGenerator: vnetHclGenerator,
  icon: vnetIcon,
};
