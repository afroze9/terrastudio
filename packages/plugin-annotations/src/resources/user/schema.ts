import type { ResourceSchema } from '@terrastudio/types';

export const userSchema: ResourceSchema = {
  typeId: '_annotation/general/user',
  provider: '_annotation',
  displayName: 'User',
  category: 'general',
  description: 'Represents a user or actor in the architecture',
  terraformType: '_annotation_user',
  supportsTags: false,
  requiresResourceGroup: false,

  properties: [
    {
      key: 'name',
      label: 'Label',
      type: 'string',
      required: false,
      placeholder: 'User',
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
