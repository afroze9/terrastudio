import type { ResourceSchema } from '@terrastudio/types';

export const mssqlServerSchema: ResourceSchema = {
  typeId: 'azurerm/database/mssql_server',
  provider: 'azurerm',
  displayName: 'SQL Server',
  category: 'database',
  description: 'Azure SQL Server for hosting SQL databases',
  terraformType: 'azurerm_mssql_server',
  supportsTags: true,
  requiresResourceGroup: true,
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
      placeholder: 'sql-myapp-dev',
      group: 'General',
      order: 1,
      description: 'Globally unique server name',
      validation: {
        minLength: 1,
        maxLength: 63,
        pattern: '^[a-z0-9][a-z0-9-]*[a-z0-9]$',
        patternMessage: 'Lowercase alphanumeric and hyphens only, must start and end with alphanumeric',
      },
    },
    {
      key: 'version',
      label: 'Server Version',
      type: 'select',
      required: true,
      group: 'General',
      order: 2,
      defaultValue: '12.0',
      options: [
        { label: '12.0', value: '12.0' },
      ],
    },
    {
      key: 'administrator_login',
      label: 'Admin Login',
      type: 'string',
      required: true,
      group: 'Authentication',
      order: 3,
      placeholder: 'sqladmin',
    },
    {
      key: 'administrator_login_password',
      label: 'Admin Password',
      type: 'string',
      required: true,
      group: 'Authentication',
      order: 4,
      description: 'Will be stored as a sensitive Terraform variable',
    },
    {
      key: 'minimum_tls_version',
      label: 'Minimum TLS',
      type: 'select',
      required: false,
      group: 'Security',
      order: 5,
      defaultValue: '1.2',
      options: [
        { label: 'TLS 1.0', value: '1.0' },
        { label: 'TLS 1.1', value: '1.1' },
        { label: 'TLS 1.2', value: '1.2' },
      ],
    },
    {
      key: 'public_network_access_enabled',
      label: 'Public Network Access',
      type: 'boolean',
      required: false,
      group: 'Security',
      order: 6,
      defaultValue: true,
    },
  ],

  handles: [],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
    { key: 'fully_qualified_domain_name', label: 'FQDN', terraformAttribute: 'fully_qualified_domain_name' },
  ],
};
