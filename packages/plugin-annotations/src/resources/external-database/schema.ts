import type { ResourceSchema } from '@terrastudio/types';

export const externalDatabaseSchema: ResourceSchema = {
  typeId: '_annotation/general/external_database',
  provider: '_annotation',
  displayName: 'External Database',
  category: 'general',
  description: 'Represents an external or on-premises database',
  terraformType: '_annotation_external_database',
  supportsTags: false,
  requiresResourceGroup: false,

  properties: [
    {
      key: 'name',
      label: 'Label',
      type: 'string',
      required: false,
      placeholder: 'Database',
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
