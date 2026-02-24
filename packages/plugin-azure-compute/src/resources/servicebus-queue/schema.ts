import type { ResourceSchema } from '@terrastudio/types';

export const serviceBusQueueSchema: ResourceSchema = {
  typeId: 'azurerm/messaging/servicebus_queue',
  provider: 'azurerm',
  displayName: 'Service Bus Queue',
  category: 'messaging',
  description: 'Azure Service Bus queue for point-to-point reliable messaging',
  terraformType: 'azurerm_servicebus_queue',
  supportsTags: false,
  requiresResourceGroup: false,
  cafAbbreviation: 'sbq',
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
      placeholder: 'my-queue',
      group: 'General',
      order: 1,
      validation: {
        minLength: 1,
        maxLength: 260,
      },
    },
    {
      key: 'lock_duration',
      label: 'Lock Duration',
      type: 'string',
      required: false,
      group: 'Settings',
      order: 2,
      defaultValue: 'PT1M',
      placeholder: 'PT1M',
      description: 'ISO 8601 duration (e.g. PT1M = 1 minute, PT5M = 5 minutes)',
    },
    {
      key: 'max_delivery_count',
      label: 'Max Delivery Count',
      type: 'number',
      required: false,
      group: 'Settings',
      order: 3,
      defaultValue: 10,
      validation: {
        min: 1,
        max: 2000,
      },
    },
    {
      key: 'requires_duplicate_detection',
      label: 'Duplicate Detection',
      type: 'boolean',
      required: false,
      group: 'Settings',
      order: 4,
      defaultValue: false,
    },
    {
      key: 'requires_session',
      label: 'Requires Session',
      type: 'boolean',
      required: false,
      group: 'Settings',
      order: 5,
      defaultValue: false,
      description: 'Enable session-based message ordering',
    },
    {
      key: 'dead_lettering_on_message_expiration',
      label: 'Dead-Letter on Expiration',
      type: 'boolean',
      required: false,
      group: 'Settings',
      order: 6,
      defaultValue: false,
    },
  ],

  handles: [],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
  ],
};
