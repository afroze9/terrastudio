import type { ResourceSchema } from '@terrastudio/types';

export const mssqlManagedInstanceAadAdministratorSchema: ResourceSchema = {
  typeId: 'azurerm/database/mssql_managed_instance_aad_administrator',
  provider: 'azurerm',
  displayName: 'SQL MI Entra Admin',
  category: 'managed-instance',
  description: 'Active Directory (Entra) administrator for a SQL Managed Instance',
  terraformType: 'azurerm_mssql_managed_instance_active_directory_administrator',
  supportsTags: false,
  requiresResourceGroup: false,

  canBeChildOf: [
    'azurerm/database/mssql_managed_instance',
  ],
  parentReference: { propertyKey: 'managed_instance_id' },

  properties: [
    {
      key: 'login_username',
      label: 'Login Name',
      type: 'string',
      required: true,
      group: 'General',
      order: 1,
      placeholder: 'sqlmi-admins@example.com',
      description: 'Entra group or user principal name',
    },
    {
      key: 'object_id',
      label: 'Object ID',
      type: 'string',
      required: true,
      group: 'General',
      order: 2,
      placeholder: '00000000-0000-0000-0000-000000000000',
      description: 'Entra group or user object ID',
    },
    {
      key: 'tenant_id',
      label: 'Tenant ID',
      type: 'string',
      required: true,
      group: 'General',
      order: 3,
      placeholder: '00000000-0000-0000-0000-000000000000',
    },
    {
      key: 'azuread_authentication_only',
      label: 'Entra Authentication Only',
      type: 'boolean',
      required: false,
      group: 'General',
      order: 4,
      defaultValue: false,
      description: 'When true, only Entra authentication is allowed (disables SQL auth)',
    },
  ],

  handles: [],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
  ],

  costEstimation: { serviceName: 'SQL MI Entra Admin', staticMonthlyCost: 0 },
};
