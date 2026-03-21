import type { ResourceSchema } from '@terrastudio/types';

export const regionSchema: ResourceSchema = {
  typeId: '_annotation/general/region',
  provider: '_annotation',
  displayName: 'Region / Zone',
  category: 'general',
  description: 'A visual boundary representing a region, zone, or logical grouping',
  terraformType: '_annotation_region',
  supportsTags: false,
  requiresResourceGroup: false,
  isContainer: true,

  containerStyle: {
    borderColor: '#9ca3af',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(156, 163, 175, 0.05)',
    headerColor: '#6b7280',
    borderRadius: 8,
    borderWidth: 2,
  },

  minSize: { width: 200, height: 150 },

  properties: [
    {
      key: 'name',
      label: 'Label',
      type: 'string',
      required: false,
      placeholder: 'Region',
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
