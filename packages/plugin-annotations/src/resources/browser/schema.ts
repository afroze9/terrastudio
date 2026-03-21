import type { ResourceSchema } from '@terrastudio/types';

export const browserSchema: ResourceSchema = {
  typeId: '_annotation/general/browser',
  provider: '_annotation',
  displayName: 'Browser',
  category: 'general',
  description: 'Represents a web browser client',
  terraformType: '_annotation_browser',
  supportsTags: false,
  requiresResourceGroup: false,

  properties: [
    {
      key: 'name',
      label: 'Label',
      type: 'string',
      required: false,
      placeholder: 'Browser',
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
