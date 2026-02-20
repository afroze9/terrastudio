import type { ResourceTypeRegistration } from '@terrastudio/types';
import { subnetSchema } from './schema.js';
import { subnetHclGenerator } from './hcl-generator.js';

export const subnetRegistration: ResourceTypeRegistration = {
  schema: subnetSchema,
  nodeComponent: null, // Svelte component — registered at app level via Vite
  hclGenerator: subnetHclGenerator,
};
