import type { ResourceSchema } from '@terrastudio/types';

export const serverSchema: ResourceSchema = {
  typeId: '_annotation/general/server',
  provider: '_annotation',
  displayName: 'Server',
  category: 'general',
  description: 'Represents an external or on-premises server',
  terraformType: '_annotation_server',
  supportsTags: false,
  requiresResourceGroup: false,

  properties: [
    {
      key: 'name',
      label: 'Label',
      type: 'string',
      required: false,
      placeholder: 'Server',
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
