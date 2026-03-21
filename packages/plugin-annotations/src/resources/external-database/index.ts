import type { ResourceTypeRegistration } from '@terrastudio/types';
import { externalDatabaseSchema } from './schema.js';
import { createNoopGenerator } from '../../noop-hcl-generator.js';
import { externalDatabaseIcon } from './icon.js';

export const externalDatabaseRegistration: ResourceTypeRegistration = {
  schema: externalDatabaseSchema,
  nodeComponent: null,
  hclGenerator: createNoopGenerator('_annotation/general/external_database'),
  icon: externalDatabaseIcon,
};
