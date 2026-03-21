import type { ResourceSchema } from '@terrastudio/types';

export const stickyNoteSchema: ResourceSchema = {
  typeId: '_annotation/general/sticky_note',
  provider: '_annotation',
  displayName: 'Sticky Note',
  category: 'general',
  description: 'A text note for annotating diagrams',
  terraformType: '_annotation_sticky_note',
  supportsTags: false,
  requiresResourceGroup: false,

  properties: [
    {
      key: 'name',
      label: 'Label',
      type: 'string',
      required: false,
      placeholder: 'My Note',
      group: 'General',
      order: 1,
    },
    {
      key: 'description',
      label: 'Description',
      type: 'string',
      required: false,
      placeholder: 'Add a description...',
      group: 'General',
      order: 2,
    },
  ],

  handles: [],
};
