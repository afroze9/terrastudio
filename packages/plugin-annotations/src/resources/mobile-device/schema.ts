import type { ResourceSchema } from '@terrastudio/types';

export const mobileDeviceSchema: ResourceSchema = {
  typeId: '_annotation/general/mobile_device',
  provider: '_annotation',
  displayName: 'Mobile Device',
  category: 'general',
  description: 'Represents a mobile phone or tablet client',
  terraformType: '_annotation_mobile_device',
  supportsTags: false,
  requiresResourceGroup: false,

  properties: [
    {
      key: 'name',
      label: 'Label',
      type: 'string',
      required: false,
      placeholder: 'Mobile',
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
