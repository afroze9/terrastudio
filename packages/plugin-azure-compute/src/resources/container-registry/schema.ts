import type { ResourceSchema } from '@terrastudio/types';

export const containerRegistrySchema: ResourceSchema = {
  typeId: 'azurerm/containers/container_registry',
  provider: 'azurerm',
  displayName: 'Container Registry',
  category: 'containers',
  description: 'Azure Container Registry for storing and managing container images',
  terraformType: 'azurerm_container_registry',
  supportsTags: true,
  requiresResourceGroup: true,
  cafAbbreviation: 'cr',
  namingConstraints: { lowercase: true, noHyphens: true, maxLength: 50 },

  canBeChildOf: [
    'azurerm/core/resource_group',
  ],

  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'myappregistry',
      group: 'General',
      order: 1,
      validation: {
        minLength: 5,
        maxLength: 50,
        pattern: '^[a-zA-Z0-9]+$',
        patternMessage: 'Must be 5-50 alphanumeric characters only',
      },
    },
    {
      key: 'sku',
      label: 'SKU',
      type: 'select',
      required: true,
      group: 'General',
      order: 2,
      defaultValue: 'Basic',
      options: [
        { label: 'Basic', value: 'Basic' },
        { label: 'Standard', value: 'Standard' },
        { label: 'Premium', value: 'Premium' },
      ],
    },
    {
      key: 'admin_enabled',
      label: 'Admin User',
      type: 'boolean',
      required: false,
      group: 'Security',
      order: 3,
      defaultValue: false,
      description: 'Enable the admin user for image push/pull authentication',
    },
    {
      key: 'public_network_access_enabled',
      label: 'Public Network Access',
      type: 'boolean',
      required: false,
      group: 'Security',
      order: 4,
      defaultValue: true,
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
    { key: 'login_server', label: 'Login Server', terraformAttribute: 'login_server' },
    { key: 'admin_username', label: 'Admin Username', terraformAttribute: 'admin_username' },
    { key: 'admin_password', label: 'Admin Password', terraformAttribute: 'admin_password', sensitive: true },
  ],
};
