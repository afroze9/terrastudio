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
    'azurerm/networking/subnet',
  ],
  visualContainment: true,
  privateEndpointConfig: {
    subresources: [
      { key: 'namespace', label: 'Service Bus Namespace' },
    ],
    defaultSubresource: 'namespace',
  },

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

    // Security
    {
      key: 'local_auth_enabled',
      label: 'Local Authentication',
      type: 'boolean',
      required: false,
      group: 'Security',
      order: 10,
      defaultValue: true,
    },
    {
      key: 'public_network_access_enabled',
      label: 'Public Network Access',
      type: 'boolean',
      required: false,
      group: 'Security',
      order: 11,
      defaultValue: true,
    },
    {
      key: 'minimum_tls_version',
      label: 'Minimum TLS Version',
      type: 'select',
      required: false,
      group: 'Security',
      order: 12,
      defaultValue: '1.2',
      options: [
        { label: '1.0', value: '1.0' },
        { label: '1.1', value: '1.1' },
        { label: '1.2', value: '1.2' },
      ],
    },

    // Identity
    {
      key: 'identity_enabled',
      label: 'Managed Identity',
      type: 'boolean',
      required: false,
      group: 'Identity',
      order: 20,
      defaultValue: false,
    },
    {
      key: 'identity_type',
      label: 'Identity Type',
      type: 'select',
      required: false,
      group: 'Identity',
      order: 21,
      defaultValue: 'SystemAssigned',
      visibleWhen: { field: 'identity_enabled', operator: 'truthy' },
      options: [
        { label: 'System Assigned', value: 'SystemAssigned' },
        { label: 'User Assigned', value: 'UserAssigned' },
        { label: 'System & User Assigned', value: 'SystemAssigned, UserAssigned' },
      ],
    },
  ],

  handles: [],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
    { key: 'default_primary_connection_string', label: 'Primary Connection String', terraformAttribute: 'default_primary_connection_string', sensitive: true },
    { key: 'default_secondary_connection_string', label: 'Secondary Connection String', terraformAttribute: 'default_secondary_connection_string', sensitive: true },
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
