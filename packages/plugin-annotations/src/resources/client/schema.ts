import type { ResourceSchema } from '@terrastudio/types';

export const clientSchema: ResourceSchema = {
  typeId: '_annotation/general/client',
  provider: '_annotation',
  displayName: 'Client',
  category: 'general',
  description: 'Represents a desktop client or workstation',
  terraformType: '_annotation_client',
  supportsTags: false,
  requiresResourceGroup: false,

  properties: [
    {
      key: 'name',
      label: 'Label',
      type: 'string',
      required: false,
      placeholder: 'Client',
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
