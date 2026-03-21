import type { ResourceSchema } from '@terrastudio/types';

export const genericAppSchema: ResourceSchema = {
  typeId: '_annotation/general/generic_app',
  provider: '_annotation',
  displayName: 'Application',
  category: 'general',
  description: 'Represents a generic application or API service',
  terraformType: '_annotation_generic_app',
  supportsTags: false,
  requiresResourceGroup: false,

  properties: [
    {
      key: 'name',
      label: 'Label',
      type: 'string',
      required: false,
      placeholder: 'My App',
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
