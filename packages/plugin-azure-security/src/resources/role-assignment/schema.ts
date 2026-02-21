import type { ResourceSchema } from '@terrastudio/types';

export const roleAssignmentSchema: ResourceSchema = {
  typeId: 'azurerm/identity/role_assignment',
  provider: 'azurerm',
  displayName: 'Role Assignment',
  category: 'identity',
  description: 'Azure RBAC role assignment binding a principal to a scope',
  terraformType: 'azurerm_role_assignment',
  supportsTags: false,
  requiresResourceGroup: false,

  properties: [
    {
      key: 'principal_id',
      label: 'Identity',
      type: 'reference',
      required: true,
      group: 'General',
      order: 1,
      description: 'The managed identity to assign the role to',
      referenceTargetTypes: [
        'azurerm/identity/user_assigned_identity',
      ],
    },
    {
      key: 'role_definition_name',
      label: 'Role',
      type: 'select',
      required: true,
      group: 'General',
      order: 2,
      defaultValue: 'Reader',
      options: [
        { label: 'Reader', value: 'Reader' },
        { label: 'Contributor', value: 'Contributor' },
        { label: 'Owner', value: 'Owner' },
        { label: 'Storage Blob Data Contributor', value: 'Storage Blob Data Contributor' },
        { label: 'Storage Blob Data Reader', value: 'Storage Blob Data Reader' },
        { label: 'Key Vault Secrets User', value: 'Key Vault Secrets User' },
        { label: 'Key Vault Crypto User', value: 'Key Vault Crypto User' },
        { label: 'SQL DB Contributor', value: 'SQL DB Contributor' },
        { label: 'Monitoring Contributor', value: 'Monitoring Contributor' },
        { label: 'AcrPush', value: 'AcrPush' },
        { label: 'AcrPull', value: 'AcrPull' },
        { label: 'Network Contributor', value: 'Network Contributor' },
      ],
    },
    {
      key: 'scope',
      label: 'Scope',
      type: 'reference',
      required: true,
      group: 'General',
      order: 3,
      description: 'The resource to assign the role on',
      referenceTargetTypes: [
        'azurerm/core/resource_group',
        'azurerm/storage/storage_account',
        'azurerm/security/key_vault',
        'azurerm/database/mssql_server',
        'azurerm/containers/container_registry',
        'azurerm/networking/virtual_network',
        'azurerm/monitoring/log_analytics_workspace',
        'azurerm/compute/app_service',
        'azurerm/compute/function_app',
      ],
    },
  ],

  handles: [],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
  ],
};
