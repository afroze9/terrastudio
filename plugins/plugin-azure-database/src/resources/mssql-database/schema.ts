import type { ResourceSchema } from '@terrastudio/types';

export const mssqlDatabaseSchema: ResourceSchema = {
  typeId: 'azurerm/database/mssql_database',
  provider: 'azurerm',
  displayName: 'SQL Database',
  category: 'database',
  description: 'Azure SQL Database hosted on a SQL Server',
  terraformType: 'azurerm_mssql_database',
  supportsTags: true,
  requiresResourceGroup: false,
  cafAbbreviation: 'sqldb',

  canBeChildOf: [
    'azurerm/database/mssql_server',
  ],

  parentReference: { propertyKey: 'server_id' },

  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'sqldb-myapp',
      group: 'General',
      order: 1,
      validation: {
        minLength: 1,
        maxLength: 128,
      },
    },
    {
      key: 'create_mode',
      label: 'Create Mode',
      type: 'select',
      required: false,
      group: 'General',
      order: 2,
      defaultValue: 'Default',
      options: [
        { label: 'Default', value: 'Default' },
        { label: 'Copy', value: 'Copy' },
        { label: 'Point In Time Restore', value: 'PointInTimeRestore' },
        { label: 'Recovery', value: 'Recovery' },
      ],
    },
    {
      key: 'sku_name',
      label: 'SKU',
      type: 'select',
      required: false,
      group: 'General',
      order: 3,
      defaultValue: 'S0',
      options: [
        { label: 'Basic', value: 'Basic' },
        { label: 'S0 (Standard)', value: 'S0' },
        { label: 'S1 (Standard)', value: 'S1' },
        { label: 'S2 (Standard)', value: 'S2' },
        { label: 'S3 (Standard)', value: 'S3' },
        { label: 'GP_Gen5_2 (General Purpose)', value: 'GP_Gen5_2' },
        { label: 'GP_Gen5_4 (General Purpose)', value: 'GP_Gen5_4' },
        { label: 'BC_Gen5_2 (Business Critical)', value: 'BC_Gen5_2' },
        { label: 'BC_Gen5_4 (Business Critical)', value: 'BC_Gen5_4' },
      ],
    },
    {
      key: 'elastic_pool_id',
      label: 'Elastic Pool ID',
      type: 'string',
      required: false,
      group: 'Configuration',
      order: 10,
      description: 'ID of the elastic pool to add this database to',
    },
    {
      key: 'collation',
      label: 'Collation',
      type: 'string',
      required: false,
      group: 'Advanced',
      order: 20,
      defaultValue: 'SQL_Latin1_General_CP1_CI_AS',
    },
    {
      key: 'max_size_gb',
      label: 'Max Size (GB)',
      type: 'number',
      required: false,
      group: 'Advanced',
      order: 21,
      defaultValue: 2,
    },
    {
      key: 'zone_redundant',
      label: 'Zone Redundant',
      type: 'boolean',
      required: false,
      group: 'Advanced',
      order: 22,
      defaultValue: false,
    },
    {
      key: 'ledger_enabled',
      label: 'Ledger',
      type: 'boolean',
      required: false,
      group: 'Advanced',
      order: 23,
      defaultValue: false,
      description: 'Enable immutable ledger feature',
    },
    {
      key: 'license_type',
      label: 'License Type',
      type: 'select',
      required: false,
      group: 'Advanced',
      order: 24,
      options: [
        { label: 'License Included', value: 'LicenseIncluded' },
        { label: 'Base Price (Azure Hybrid Benefit)', value: 'BasePrice' },
      ],
    },
  ],

  handles: [],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
  ],

  costEstimation: {
    serviceName: 'SQL Database',
    skuProperty: 'sku_name',
  },
};
