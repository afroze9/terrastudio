import type { Template } from '../types';

export const webAppSqlTemplate: Template = {
  templateVersion: 1,
  metadata: {
    id: 'web-app-sql',
    name: 'Web App + SQL Database',
    description: 'App Service with SQL Database backend and Application Insights monitoring',
    categories: ['Web Applications'],
    icon: 'web',
  },
  diagram: {
    nodes: [
      // Subscription container
      {
        id: 'tmpl-sub',
        type: 'azurerm/core/subscription',
        position: { x: 50, y: 50 },
        data: {
          typeId: 'azurerm/core/subscription',
          properties: {},
          references: {},
          terraformName: 'sub_1',
          label: 'Subscription',
          validationErrors: [],
          enabledOutputs: [],
        },
        width: 1100,
        height: 750,
        style: 'width: 1100px; height: 750px;',
      },
      // Resource Group
      {
        id: 'tmpl-rg',
        type: 'azurerm/core/resource_group',
        position: { x: 50, y: 60 },
        parentId: 'tmpl-sub',
        data: {
          typeId: 'azurerm/core/resource_group',
          properties: { location: 'eastus' },
          references: {},
          terraformName: 'rg_1',
          label: 'Resource Group',
          validationErrors: [],
          enabledOutputs: [],
        },
        width: 1000,
        height: 650,
        style: 'width: 1000px; height: 650px;',
      },
      // App Service Plan (container, left side)
      {
        id: 'tmpl-plan',
        type: 'azurerm/compute/app_service_plan',
        position: { x: 30, y: 60 },
        parentId: 'tmpl-rg',
        data: {
          typeId: 'azurerm/compute/app_service_plan',
          properties: {
            name: 'webapp',
            os_type: 'Linux',
            sku_name: 'B1',
          },
          references: {},
          terraformName: 'asp_1',
          label: 'App Service Plan',
          validationErrors: [],
          enabledOutputs: [],
        },
        width: 350,
        height: 250,
        style: 'width: 350px; height: 250px;',
      },
      // App Service (inside the plan)
      {
        id: 'tmpl-app',
        type: 'azurerm/compute/app_service',
        position: { x: 30, y: 60 },
        parentId: 'tmpl-plan',
        data: {
          typeId: 'azurerm/compute/app_service',
          properties: {
            name: 'webapp',
            os_type: 'linux',
            runtime_stack: 'NODE|18-lts',
            https_only: true,
            always_on: false,
          },
          references: {},
          terraformName: 'app_1',
          label: 'Web App',
          validationErrors: [],
          enabledOutputs: [],
        },
      },
      // SQL Server (container, right side)
      {
        id: 'tmpl-sql-server',
        type: 'azurerm/database/mssql_server',
        position: { x: 450, y: 60 },
        parentId: 'tmpl-rg',
        data: {
          typeId: 'azurerm/database/mssql_server',
          properties: {
            name: 'sqlserver',
            version: '12.0',
            administrator_login: 'sqladmin',
            administrator_login_password: '',
            minimum_tls_version: '1.2',
            public_network_access_enabled: true,
          },
          references: {},
          terraformName: 'sql_1',
          label: 'SQL Server',
          validationErrors: [],
          enabledOutputs: [],
        },
        width: 350,
        height: 250,
        style: 'width: 350px; height: 250px;',
      },
      // SQL Database (inside the server)
      {
        id: 'tmpl-sql-db',
        type: 'azurerm/database/mssql_database',
        position: { x: 30, y: 60 },
        parentId: 'tmpl-sql-server',
        data: {
          typeId: 'azurerm/database/mssql_database',
          properties: {
            name: 'appdb',
            sku_name: 'S0',
            collation: 'SQL_Latin1_General_CP1_CI_AS',
            max_size_gb: 2,
            zone_redundant: false,
          },
          references: {},
          terraformName: 'sqldb_1',
          label: 'App Database',
          validationErrors: [],
          enabledOutputs: [],
        },
      },
      // Application Insights (bottom left)
      {
        id: 'tmpl-appinsights',
        type: 'azurerm/monitoring/application_insights',
        position: { x: 30, y: 380 },
        parentId: 'tmpl-rg',
        data: {
          typeId: 'azurerm/monitoring/application_insights',
          properties: {
            name: 'appinsights',
            application_type: 'web',
            retention_in_days: 90,
            sampling_percentage: 100,
          },
          references: {},
          terraformName: 'appi_1',
          label: 'Application Insights',
          validationErrors: [],
          enabledOutputs: [],
        },
      },
    ],
    edges: [],
  },
};
