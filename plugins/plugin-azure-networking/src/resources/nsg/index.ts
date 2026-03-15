import type { ResourceTypeRegistration } from '@terrastudio/types';
import { nsgSchema } from './schema.js';
import { nsgHclGenerator } from './hcl-generator.js';
import { nsgIcon } from './icon.js';

export const nsgRegistration: ResourceTypeRegistration = {
  schema: nsgSchema,
  nodeComponent: null, // Svelte component — registered at app level via Vite
  hclGenerator: nsgHclGenerator,
  icon: nsgIcon,
};
