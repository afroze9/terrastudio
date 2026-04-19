import type { ResourceSchema } from '@terrastudio/types';

export const appConfigurationSchema: ResourceSchema = {
  typeId: 'azurerm/integration/app_configuration',
  provider: 'azurerm',
  displayName: 'App Configuration',
  category: 'integration',
  description: 'Azure App Configuration — centralised runtime configuration with Key Vault references',
  terraformType: 'azurerm_app_configuration',
  supportsTags: true,
  requiresResourceGroup: true,
  cafAbbreviation: 'appcs',
  namingConstraints: { maxLength: 50 },

  canBeChildOf: [
    'azurerm/core/resource_group',
    'azurerm/networking/subnet',
  ],
  privateEndpointConfig: {
    subresources: [
      { key: 'configurationStores', label: 'App Configuration' },
    ],
    defaultSubresource: 'configurationStores',
  },

  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'appcs-myapp-dev',
      group: 'General',
      order: 1,
      validation: {
        minLength: 5,
        maxLength: 50,
        pattern: '^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$',
        patternMessage: 'Alphanumeric and hyphens, must start and end with alphanumeric',
      },
    },
    {
      key: 'sku',
      label: 'SKU',
      type: 'select',
      required: true,
      group: 'General',
      order: 2,
      defaultValue: 'standard',
      options: [
        { label: 'Free', value: 'free' },
        { label: 'Standard', value: 'standard' },
        { label: 'Premium', value: 'premium' },
      ],
    },
    {
      key: 'public_network_access',
      label: 'Public Network Access',
      type: 'select',
      required: false,
      group: 'Security',
      order: 10,
      defaultValue: 'Enabled',
      options: [
        { label: 'Enabled', value: 'Enabled' },
        { label: 'Disabled', value: 'Disabled' },
      ],
      description: 'Disable when using Private Endpoint exclusively',
    },
    {
      key: 'local_auth_enabled',
      label: 'Local Auth',
      type: 'boolean',
      required: false,
      group: 'Security',
      order: 11,
      defaultValue: true,
      description: 'Disable to force Azure AD authentication only',
    },
    {
      key: 'purge_protection_enabled',
      label: 'Purge Protection',
      type: 'boolean',
      required: false,
      group: 'Protection',
      order: 20,
      defaultValue: false,
      description: 'Once enabled, cannot be disabled',
    },
    {
      key: 'soft_delete_retention_days',
      label: 'Soft Delete Retention (days)',
      type: 'number',
      required: false,
      group: 'Protection',
      order: 21,
      defaultValue: 7,
      validation: { min: 1, max: 7 },
    },
    {
      key: 'identity_enabled',
      label: 'Managed Identity',
      type: 'boolean',
      required: false,
      group: 'Identity',
      order: 30,
      defaultValue: false,
    },
    {
      key: 'identity_type',
      label: 'Identity Type',
      type: 'select',
      required: false,
      group: 'Identity',
      order: 31,
      defaultValue: 'SystemAssigned',
      visibleWhen: { field: 'identity_enabled', operator: 'truthy' },
      options: [
        { label: 'System Assigned', value: 'SystemAssigned' },
        { label: 'User Assigned', value: 'UserAssigned' },
        { label: 'System & User Assigned', value: 'SystemAssigned, UserAssigned' },
      ],
    },
  ],

  handles: [
    {
      id: 'pep-target',
      type: 'target',
      position: 'left',
      label: 'Private Endpoint',
    },
  ],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
    { key: 'endpoint', label: 'Endpoint', terraformAttribute: 'endpoint' },
    { key: 'primary_read_key_connection_string', label: 'Primary Read Connection String', terraformAttribute: 'primary_read_key[0].connection_string', sensitive: true },
    { key: 'primary_write_key_connection_string', label: 'Primary Write Connection String', terraformAttribute: 'primary_write_key[0].connection_string', sensitive: true },
  ],

  costEstimation: {
    serviceName: 'App Configuration',
    skuProperty: 'sku',
    usageInputs: [
      {
        key: '_cost_requests_10k',
        label: 'Requests',
        unit: '× 10,000/mo',
        defaultValue: 100,
        min: 0,
        max: 100000,
        description: 'Standard: first 200k req/day free, ~$0.60 per additional 10k requests',
      },
    ],
  },
};
