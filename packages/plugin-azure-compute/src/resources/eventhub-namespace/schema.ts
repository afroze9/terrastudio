import type { ResourceSchema } from '@terrastudio/types';

export const eventhubNamespaceSchema: ResourceSchema = {
  typeId: 'azurerm/messaging/eventhub_namespace',
  provider: 'azurerm',
  displayName: 'Event Hub Namespace',
  category: 'messaging',
  description: 'Azure Event Hubs namespace — real-time data ingestion and streaming platform',
  terraformType: 'azurerm_eventhub_namespace',
  supportsTags: true,
  requiresResourceGroup: true,
  cafAbbreviation: 'evhns',
  namingConstraints: { maxLength: 50 },
  isContainer: true,

  canBeChildOf: [
    'azurerm/core/resource_group',
    'azurerm/networking/subnet',
  ],
  visualContainment: true,
  privateEndpointConfig: {
    subresources: [
      { key: 'namespace', label: 'Event Hub Namespace' },
    ],
    defaultSubresource: 'namespace',
  },

  containerStyle: {
    borderColor: '#7B1FA2',
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
      placeholder: 'evhns-myapp-dev',
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
        { label: 'Basic (1 consumer group, 1-day retention)', value: 'Basic' },
        { label: 'Standard (20 consumer groups, 7-day retention)', value: 'Standard' },
        { label: 'Premium (dedicated, 90-day retention)', value: 'Premium' },
      ],
    },
    {
      key: 'capacity',
      label: 'Throughput Units',
      type: 'number',
      required: false,
      group: 'General',
      order: 3,
      defaultValue: 1,
      visibleWhen: { field: 'sku', operator: 'neq', value: 'Basic' },
      validation: {
        min: 1,
        max: 40,
      },
      description: 'Number of throughput units (Standard/Premium only)',
    },
    {
      key: 'auto_inflate_enabled',
      label: 'Auto-Inflate',
      type: 'boolean',
      required: false,
      group: 'Scaling',
      order: 4,
      defaultValue: false,
      visibleWhen: { field: 'sku', operator: 'eq', value: 'Standard' },
      description: 'Automatically scale throughput units up when needed',
    },
    {
      key: 'maximum_throughput_units',
      label: 'Max Throughput Units',
      type: 'number',
      required: false,
      group: 'Scaling',
      order: 5,
      defaultValue: 20,
      visibleWhen: { field: 'auto_inflate_enabled', operator: 'eq', value: true },
      validation: {
        min: 1,
        max: 40,
      },
      description: 'Upper limit for auto-inflate throughput units',
    },
  ],

  handles: [],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
    { key: 'default_primary_connection_string', label: 'Primary Connection String', terraformAttribute: 'default_primary_connection_string', sensitive: true },
  ],

  costEstimation: {
    serviceName: 'Event Hubs',
    skuProperty: 'sku',
  },
};
