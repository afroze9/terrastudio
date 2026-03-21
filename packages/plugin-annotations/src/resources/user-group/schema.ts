import type { ResourceSchema } from '@terrastudio/types';

export const userGroupSchema: ResourceSchema = {
  typeId: '_annotation/general/user_group',
  provider: '_annotation',
  displayName: 'User Group',
  category: 'general',
  description: 'Represents a group of users or actors',
  terraformType: '_annotation_user_group',
  supportsTags: false,
  requiresResourceGroup: false,

  properties: [
    {
      key: 'name',
      label: 'Label',
      type: 'string',
      required: false,
      placeholder: 'Users',
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
