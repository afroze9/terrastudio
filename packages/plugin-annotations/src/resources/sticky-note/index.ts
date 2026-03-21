import type { ResourceTypeRegistration } from '@terrastudio/types';
import { stickyNoteSchema } from './schema.js';
import { createNoopGenerator } from '../../noop-hcl-generator.js';
import { stickyNoteIcon } from './icon.js';

export const stickyNoteRegistration: ResourceTypeRegistration = {
  schema: stickyNoteSchema,
  nodeComponent: null,
  hclGenerator: createNoopGenerator('_annotation/general/sticky_note'),
  icon: stickyNoteIcon,
};
