import type { ResourceSchema } from '@terrastudio/types';

export const communicationServiceSchema: ResourceSchema = {
  typeId: 'azurerm/messaging/communication_service',
  provider: 'azurerm',
  displayName: 'Communication Service',
  category: 'messaging',
  description: 'Azure Communication Services — SMS, voice, chat, and email APIs',
  terraformType: 'azurerm_communication_service',
  supportsTags: true,
  requiresResourceGroup: true,
  cafAbbreviation: 'acs',
  namingConstraints: { maxLength: 63 },

  canBeChildOf: [
    'azurerm/core/resource_group',
  ],

  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'acs-myapp-dev',
      group: 'General',
      order: 1,
      validation: {
        minLength: 1,
        maxLength: 63,
      },
    },
    {
      key: 'data_location',
      label: 'Data Location',
      type: 'select',
      required: true,
      group: 'General',
      order: 2,
      defaultValue: 'United States',
      description: 'The geography data at rest is stored in (cannot be changed after creation)',
      options: [
        { label: 'United States', value: 'United States' },
        { label: 'Europe', value: 'Europe' },
        { label: 'Asia Pacific', value: 'Asia Pacific' },
        { label: 'Australia', value: 'Australia' },
        { label: 'United Kingdom', value: 'United Kingdom' },
        { label: 'France', value: 'France' },
        { label: 'Germany', value: 'Germany' },
        { label: 'Canada', value: 'Canada' },
        { label: 'UAE', value: 'UAE' },
        { label: 'India', value: 'India' },
        { label: 'Japan', value: 'Japan' },
        { label: 'Korea', value: 'Korea' },
        { label: 'Norway', value: 'Norway' },
        { label: 'Switzerland', value: 'Switzerland' },
        { label: 'Brazil', value: 'Brazil' },
      ],
    },
  ],

  handles: [],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
    { key: 'primary_connection_string', label: 'Primary Connection String', terraformAttribute: 'primary_connection_string', sensitive: true },
    { key: 'secondary_connection_string', label: 'Secondary Connection String', terraformAttribute: 'secondary_connection_string', sensitive: true },
    { key: 'primary_key', label: 'Primary Key', terraformAttribute: 'primary_key', sensitive: true },
    { key: 'secondary_key', label: 'Secondary Key', terraformAttribute: 'secondary_key', sensitive: true },
    { key: 'hostname', label: 'Hostname', terraformAttribute: 'hostname' },
  ],

  costEstimation: { serviceName: 'Communication Services', staticMonthlyCost: 0 },
};
