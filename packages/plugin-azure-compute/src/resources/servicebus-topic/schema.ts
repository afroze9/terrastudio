import type { ResourceSchema } from '@terrastudio/types';

export const serviceBusTopicSchema: ResourceSchema = {
  typeId: 'azurerm/messaging/servicebus_topic',
  provider: 'azurerm',
  displayName: 'Service Bus Topic',
  category: 'messaging',
  description: 'Azure Service Bus topic for publish-subscribe messaging patterns',
  terraformType: 'azurerm_servicebus_topic',
  supportsTags: false,
  requiresResourceGroup: false,
  cafAbbreviation: 'sbt',
  namingConstraints: { maxLength: 260 },

  canBeChildOf: [
    'azurerm/messaging/servicebus_namespace',
  ],

  parentReference: { propertyKey: 'namespace_id' },

  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'my-topic',
      group: 'General',
      order: 1,
      validation: {
        minLength: 1,
        maxLength: 260,
      },
    },
    {
      key: 'max_size_in_megabytes',
      label: 'Max Size (MB)',
      type: 'select',
      required: false,
      group: 'Settings',
      order: 2,
      defaultValue: '1024',
      options: [
        { label: '1 GB', value: '1024' },
        { label: '2 GB', value: '2048' },
        { label: '3 GB', value: '3072' },
        { label: '4 GB', value: '4096' },
        { label: '5 GB', value: '5120' },
      ],
    },
    {
      key: 'requires_duplicate_detection',
      label: 'Duplicate Detection',
      type: 'boolean',
      required: false,
      group: 'Settings',
      order: 3,
      defaultValue: false,
    },
    {
      key: 'support_ordering',
      label: 'Support Ordering',
      type: 'boolean',
      required: false,
      group: 'Settings',
      order: 4,
      defaultValue: false,
    },
  ],

  handles: [],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
  ],
};
