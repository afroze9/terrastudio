import type { ResourceSchema } from '@terrastudio/types';

export const emailCommunicationServiceSchema: ResourceSchema = {
  typeId: 'azurerm/messaging/email_communication_service',
  provider: 'azurerm',
  displayName: 'Email Communication Service',
  category: 'messaging',
  description: 'Azure Email Communication Service — email-only subset of ACS',
  terraformType: 'azurerm_email_communication_service',
  supportsTags: true,
  requiresResourceGroup: true,
  cafAbbreviation: 'acsem',
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
      placeholder: 'acsem-myapp-dev',
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
  ],

  costEstimation: { serviceName: 'Email Communication Service', staticMonthlyCost: 0 },
};
