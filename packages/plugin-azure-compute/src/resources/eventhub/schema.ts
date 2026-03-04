import type { ResourceSchema } from '@terrastudio/types';

export const eventhubSchema: ResourceSchema = {
  typeId: 'azurerm/messaging/eventhub',
  provider: 'azurerm',
  displayName: 'Event Hub',
  category: 'messaging',
  description: 'Azure Event Hub — individual event stream within an Event Hub Namespace',
  terraformType: 'azurerm_eventhub',
  supportsTags: false,
  requiresResourceGroup: true,
  cafAbbreviation: 'evh',
  namingConstraints: { maxLength: 256 },

  canBeChildOf: [
    'azurerm/messaging/eventhub_namespace',
  ],

  parentReference: { propertyKey: 'namespace_name' },

  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'my-eventhub',
      group: 'General',
      order: 1,
      validation: {
        minLength: 1,
        maxLength: 256,
      },
    },
    {
      key: 'partition_count',
      label: 'Partition Count',
      type: 'number',
      required: true,
      group: 'Settings',
      order: 2,
      defaultValue: 2,
      validation: {
        min: 1,
        max: 32,
      },
      description: 'Number of partitions for parallel processing',
    },
    {
      key: 'message_retention',
      label: 'Message Retention (days)',
      type: 'number',
      required: true,
      group: 'Settings',
      order: 3,
      defaultValue: 1,
      validation: {
        min: 1,
        max: 7,
      },
      description: 'Days to retain events',
    },
  ],

  handles: [],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
  ],
};
