import type { ResourceSchema } from '@terrastudio/types';

export const serviceBusNamespaceSchema: ResourceSchema = {
  typeId: 'azurerm/messaging/servicebus_namespace',
  provider: 'azurerm',
  displayName: 'Service Bus Namespace',
  category: 'messaging',
  description: 'Azure Service Bus namespace — enterprise messaging with queues and topics',
  terraformType: 'azurerm_servicebus_namespace',
  supportsTags: true,
  requiresResourceGroup: true,
  cafAbbreviation: 'sb',
  namingConstraints: { maxLength: 50 },
  isContainer: true,

  canBeChildOf: [
    'azurerm/core/resource_group',
  ],

  containerStyle: {
    borderColor: '#2B7CF6',
    borderStyle: 'dotted',
    backgroundColor: '#ffffff',
    headerColor: '#1a1a2e',
    borderRadius: 12,
    borderWidth: 3,
    hideHeaderBorder: true,
    iconSize: 28,
    labelSize: 16,
    dashArray: '4,8',
  },

  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'sb-myapp-dev',
      group: 'General',
      order: 1,
      validation: {
        minLength: 6,
        maxLength: 50,
        pattern: '^[a-zA-Z][a-zA-Z0-9-]*[a-zA-Z0-9]$',
        patternMessage: 'Must start with a letter, alphanumerics and hyphens only',
      },
    },
    {
      key: 'sku',
      label: 'SKU',
      type: 'select',
      required: true,
      group: 'General',
      order: 2,
      defaultValue: 'Standard',
      options: [
        { label: 'Basic (queues only, no topics)', value: 'Basic' },
        { label: 'Standard (queues + topics)', value: 'Standard' },
        { label: 'Premium (dedicated, VNet, geo-DR)', value: 'Premium' },
      ],
    },
    {
      key: 'capacity',
      label: 'Messaging Units',
      type: 'select',
      required: false,
      group: 'General',
      order: 3,
      defaultValue: '1',
      visibleWhen: { field: 'sku', operator: 'eq', value: 'Premium' },
      options: [
        { label: '1 MU', value: '1' },
        { label: '2 MU', value: '2' },
        { label: '4 MU', value: '4' },
        { label: '8 MU', value: '8' },
        { label: '16 MU', value: '16' },
      ],
      description: 'Messaging Units required for Premium SKU',
    },
    {
      key: 'zone_redundant',
      label: 'Zone Redundant',
      type: 'boolean',
      required: false,
      group: 'Availability',
      order: 4,
      defaultValue: false,
      visibleWhen: { field: 'sku', operator: 'eq', value: 'Premium' },
      description: 'Enable zone redundancy (Premium only)',
    },
  ],

  handles: [],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
    { key: 'default_primary_connection_string', label: 'Primary Connection String', terraformAttribute: 'default_primary_connection_string', sensitive: true },
  ],

  costEstimation: {
    serviceName: 'Azure Service Bus',
    skuProperty: 'sku',
    usageInputs: [
      {
        key: '_cost_operations_millions',
        label: 'Messaging Operations',
        unit: 'million ops/mo',
        defaultValue: 10,
        min: 0,
        max: 100000,
        description: 'Standard tier: first 10M ops included; extra ~$0.80/million (Basic: $0.05/million)',
      },
    ],
  },
};
