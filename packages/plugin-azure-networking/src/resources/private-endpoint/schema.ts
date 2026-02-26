import type { ResourceSchema } from '@terrastudio/types';

export const privateEndpointSchema: ResourceSchema = {
  typeId: 'azurerm/networking/private_endpoint',
  provider: 'azurerm',
  displayName: 'Private Endpoint',
  category: 'networking',
  description: 'Azure Private Endpoint for secure private connectivity to PaaS resources',
  terraformType: 'azurerm_private_endpoint',
  supportsTags: true,
  requiresResourceGroup: true,
  cafAbbreviation: 'pep',

  canBeChildOf: [
    'azurerm/networking/subnet',
    'azurerm/core/resource_group',
  ],

  parentReference: { propertyKey: 'subnet_id' },

  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'pe-myapp-storage',
      group: 'General',
      order: 1,
      validation: {
        minLength: 2,
        maxLength: 64,
        pattern: '^[a-zA-Z0-9][a-zA-Z0-9_.-]*[a-zA-Z0-9]$',
        patternMessage: 'Must start and end with alphanumeric',
      },
    },
    {
      key: 'target_resource_id',
      label: 'Target Resource',
      type: 'reference',
      required: true,
      group: 'Connection',
      order: 2,
      description: 'The PaaS resource to connect to privately',
      showAsEdge: true,
      referenceTargetTypes: [
        'azurerm/storage/storage_account',
        'azurerm/security/key_vault',
        'azurerm/database/mssql_server',
        'azurerm/containers/container_registry',
        'azurerm/compute/app_service',
        'azurerm/compute/function_app',
        'azurerm/monitoring/log_analytics_workspace',
      ],
    },
    {
      key: 'subresource_names',
      label: 'Subresource',
      type: 'select',
      required: true,
      group: 'Connection',
      order: 3,
      defaultValue: 'blob',
      description: 'Storage: blob/file/queue/table, Key Vault: vault, SQL: sqlServer, ACR: registry, App Service/Functions: sites',
      options: [
        { label: 'blob (Storage)', value: 'blob' },
        { label: 'file (Storage)', value: 'file' },
        { label: 'queue (Storage)', value: 'queue' },
        { label: 'table (Storage)', value: 'table' },
        { label: 'vault (Key Vault)', value: 'vault' },
        { label: 'sqlServer (SQL)', value: 'sqlServer' },
        { label: 'registry (ACR)', value: 'registry' },
        { label: 'sites (App Service / Functions)', value: 'sites' },
      ],
    },
    {
      key: 'dns_zone_enabled',
      label: 'Private DNS Integration',
      type: 'boolean',
      required: false,
      group: 'DNS',
      order: 10,
      defaultValue: false,
      description: 'Enable Private DNS Zone integration for automatic DNS records',
    },
    {
      key: 'dns_zone_id',
      label: 'Private DNS Zone',
      type: 'reference',
      required: false,
      group: 'DNS',
      order: 11,
      referenceTargetTypes: [
        'azurerm/networking/private_dns_zone',
      ],
      visibleWhen: { field: 'dns_zone_enabled', operator: 'truthy' },
    },
  ],

  handles: [],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
    { key: 'private_ip_address', label: 'Private IP', terraformAttribute: 'private_service_connection.0.private_ip_address' },
  ],
};
