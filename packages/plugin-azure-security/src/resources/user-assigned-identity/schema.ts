import type { ResourceSchema } from '@terrastudio/types';

export const userAssignedIdentitySchema: ResourceSchema = {
  typeId: 'azurerm/identity/user_assigned_identity',
  provider: 'azurerm',
  displayName: 'Managed Identity',
  category: 'identity',
  description: 'User Assigned Managed Identity for Azure RBAC',
  terraformType: 'azurerm_user_assigned_identity',
  supportsTags: true,
  requiresResourceGroup: true,

  canBeChildOf: [
    'azurerm/core/resource_group',
  ],

  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'id-myapp-dev',
      group: 'General',
      order: 1,
      validation: {
        minLength: 3,
        maxLength: 128,
        pattern: '^[a-zA-Z0-9][a-zA-Z0-9_-]*$',
        patternMessage: 'Must start with alphanumeric, can contain hyphens and underscores',
      },
    },
  ],

  handles: [],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
    { key: 'principal_id', label: 'Principal ID', terraformAttribute: 'principal_id' },
    { key: 'client_id', label: 'Client ID', terraformAttribute: 'client_id' },
    { key: 'tenant_id', label: 'Tenant ID', terraformAttribute: 'tenant_id' },
  ],
};
