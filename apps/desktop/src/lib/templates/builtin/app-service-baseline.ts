import type { Template } from '../types';

export const appServiceBaselineTemplate: Template = {
  templateVersion: 1,
  metadata: {
    id: 'app-service-baseline',
    name: 'App Service Baseline (Zone-Redundant)',
    description:
      'Zone-redundant web application following the Azure App Service baseline architecture. Includes VNet with integration and private-endpoint subnets, SQL Database (zone-redundant), Key Vault, Storage (ZRS), private endpoints with DNS zones, and monitoring. Based on https://learn.microsoft.com/en-us/azure/architecture/web-apps/app-service/architectures/baseline-zone-redundant',
    categories: ['Web Applications', 'Networking'],
    icon: 'web',
  },
  diagram: {
    nodes: [
      // ── Subscription ────────────────────────────────────────────────────
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
        width: 2400,
        height: 1000,
        style: 'width: 2400px; height: 1000px;',
      },
      // ── Resource Group ──────────────────────────────────────────────────
      {
        id: 'tmpl-rg',
        type: 'azurerm/core/resource_group',
        position: { x: 50, y: 50 },
        parentId: 'tmpl-sub',
        data: {
          typeId: 'azurerm/core/resource_group',
          properties: { location: 'eastus' },
          references: {},
          terraformName: 'rg_webapp',
          label: 'Resource Group',
          validationErrors: [],
          enabledOutputs: [],
        },
        width: 2300,
        height: 900,
        style: 'width: 2300px; height: 900px;',
      },

      // ── Virtual Network ─────────────────────────────────────────────────
      {
        id: 'tmpl-vnet',
        type: 'azurerm/networking/virtual_network',
        position: { x: 30, y: 60 },
        parentId: 'tmpl-rg',
        data: {
          typeId: 'azurerm/networking/virtual_network',
          properties: {
            name: 'webapp',
            address_space: ['10.0.0.0/16'],
          },
          references: {},
          terraformName: 'vnet_webapp',
          label: 'VNet',
          validationErrors: [],
          enabledOutputs: [],
        },
        width: 780,
        height: 560,
        style: 'width: 780px; height: 560px;',
      },
      // App Service Integration Subnet
      {
        id: 'tmpl-snet-app',
        type: 'azurerm/networking/subnet',
        position: { x: 30, y: 80 },
        parentId: 'tmpl-vnet',
        data: {
          typeId: 'azurerm/networking/subnet',
          properties: {
            name: 'app-integration',
            address_prefixes: ['10.0.0.0/24'],
            nsg_enabled: true,
            delegation_enabled: true,
            delegation_service: 'Microsoft.Web/serverFarms',
          },
          references: { nsg_id: 'tmpl-nsg-app' },
          terraformName: 'snet_app_integration',
          label: 'App Service Integration',
          validationErrors: [],
          enabledOutputs: [],
        },
        width: 720,
        height: 160,
        style: 'width: 720px; height: 160px;',
      },
      // Private Endpoints Subnet
      {
        id: 'tmpl-snet-pe',
        type: 'azurerm/networking/subnet',
        position: { x: 30, y: 270 },
        parentId: 'tmpl-vnet',
        data: {
          typeId: 'azurerm/networking/subnet',
          properties: {
            name: 'private-endpoints',
            address_prefixes: ['10.0.1.0/24'],
            nsg_enabled: true,
          },
          references: { nsg_id: 'tmpl-nsg-pe' },
          terraformName: 'snet_private_endpoints',
          label: 'Private Endpoints',
          validationErrors: [],
          enabledOutputs: [],
        },
        width: 720,
        height: 220,
        style: 'width: 720px; height: 220px;',
      },

      // ── Private Endpoints (inside PE subnet) ────────────────────────────
      {
        id: 'tmpl-pe-sql',
        type: 'azurerm/networking/private_endpoint',
        position: { x: 20, y: 70 },
        parentId: 'tmpl-snet-pe',
        data: {
          typeId: 'azurerm/networking/private_endpoint',
          properties: {
            name: 'pe-sql',
            subresource_names: 'sqlServer',
            dns_zone_enabled: true,
          },
          references: {
            target_resource_id: 'tmpl-sql',
            dns_zone_id: 'tmpl-pdz-sql',
          },
          terraformName: 'pep_sql',
          label: 'PE SQL',
          validationErrors: [],
          enabledOutputs: [],
        },
      },
      {
        id: 'tmpl-pe-kv',
        type: 'azurerm/networking/private_endpoint',
        position: { x: 255, y: 70 },
        parentId: 'tmpl-snet-pe',
        data: {
          typeId: 'azurerm/networking/private_endpoint',
          properties: {
            name: 'pe-kv',
            subresource_names: 'vault',
            dns_zone_enabled: true,
          },
          references: {
            target_resource_id: 'tmpl-kv',
            dns_zone_id: 'tmpl-pdz-kv',
          },
          terraformName: 'pep_kv',
          label: 'PE Key Vault',
          validationErrors: [],
          enabledOutputs: [],
        },
      },
      {
        id: 'tmpl-pe-storage',
        type: 'azurerm/networking/private_endpoint',
        position: { x: 490, y: 70 },
        parentId: 'tmpl-snet-pe',
        data: {
          typeId: 'azurerm/networking/private_endpoint',
          properties: {
            name: 'pe-storage',
            subresource_names: 'blob',
            dns_zone_enabled: true,
          },
          references: {
            target_resource_id: 'tmpl-storage',
            dns_zone_id: 'tmpl-pdz-storage',
          },
          terraformName: 'pep_storage',
          label: 'PE Storage',
          validationErrors: [],
          enabledOutputs: [],
        },
      },

      // ── NSGs (in RG, referenced by subnets) ─────────────────────────────
      {
        id: 'tmpl-nsg-app',
        type: 'azurerm/networking/network_security_group',
        position: { x: 30, y: 760 },
        parentId: 'tmpl-rg',
        data: {
          typeId: 'azurerm/networking/network_security_group',
          properties: { name: 'nsg-app-integration', security_rules: [] },
          references: {},
          terraformName: 'nsg_app_integration',
          label: 'App Integration NSG',
          validationErrors: [],
          enabledOutputs: [],
        },
      },
      {
        id: 'tmpl-nsg-pe',
        type: 'azurerm/networking/network_security_group',
        position: { x: 260, y: 760 },
        parentId: 'tmpl-rg',
        data: {
          typeId: 'azurerm/networking/network_security_group',
          properties: { name: 'nsg-private-endpoints', security_rules: [] },
          references: {},
          terraformName: 'nsg_private_endpoints',
          label: 'Private Endpoints NSG',
          validationErrors: [],
          enabledOutputs: [],
        },
      },

      // ── App Service Plan (Premium V3 — zone-redundant, 3 instances) ──────
      {
        id: 'tmpl-asp',
        type: 'azurerm/compute/app_service_plan',
        position: { x: 830, y: 60 },
        parentId: 'tmpl-rg',
        data: {
          typeId: 'azurerm/compute/app_service_plan',
          properties: {
            name: 'webapp',
            os_type: 'Linux',
            sku_name: 'P2v3',
            worker_count: 3,
            zone_balancing_enabled: true,
          },
          references: {},
          terraformName: 'asp_webapp',
          label: 'App Service Plan (P2v3, Zone-Redundant)',
          validationErrors: [],
          enabledOutputs: [],
        },
        width: 450,
        height: 270,
        style: 'width: 450px; height: 270px;',
      },
      // App Service (.NET 8)
      {
        id: 'tmpl-app',
        type: 'azurerm/compute/app_service',
        position: { x: 30, y: 80 },
        parentId: 'tmpl-asp',
        data: {
          typeId: 'azurerm/compute/app_service',
          properties: {
            name: 'webapp',
            os_type: 'linux',
            runtime_stack: 'DOTNETCORE|8.0',
            https_only: true,
            always_on: true,
          },
          references: {},
          terraformName: 'app_webapp',
          label: 'Web App',
          validationErrors: [],
          enabledOutputs: [],
        },
      },
      // VNet Integration NIC (inside app-integration subnet)
      {
        id: 'tmpl-vnetint',
        type: 'azurerm/networking/vnet_integration',
        position: { x: 290, y: 50 },
        parentId: 'tmpl-snet-app',
        data: {
          typeId: 'azurerm/networking/vnet_integration',
          properties: {},
          references: { app_service_id: 'tmpl-app' },
          terraformName: 'vnetint_webapp',
          label: 'VNet Integration',
          validationErrors: [],
          enabledOutputs: [],
        },
      },

      // ── SQL Server ───────────────────────────────────────────────────────
      {
        id: 'tmpl-sql',
        type: 'azurerm/database/mssql_server',
        position: { x: 830, y: 370 },
        parentId: 'tmpl-rg',
        data: {
          typeId: 'azurerm/database/mssql_server',
          properties: {
            name: 'webapp',
            version: '12.0',
            administrator_login: 'sqladmin',
            administrator_login_password: '',
            minimum_tls_version: '1.2',
            public_network_access_enabled: false,
          },
          references: {},
          terraformName: 'sql_webapp',
          label: 'SQL Server',
          validationErrors: [],
          enabledOutputs: [],
        },
        width: 450,
        height: 250,
        style: 'width: 450px; height: 250px;',
      },
      // SQL Database — zone-redundant (GP_Gen5_2)
      {
        id: 'tmpl-sqldb',
        type: 'azurerm/database/mssql_database',
        position: { x: 30, y: 80 },
        parentId: 'tmpl-sql',
        data: {
          typeId: 'azurerm/database/mssql_database',
          properties: {
            name: 'appdb',
            sku_name: 'GP_Gen5_2',
            zone_redundant: true,
            max_size_gb: 32,
          },
          references: {},
          terraformName: 'sqldb_app',
          label: 'App Database (Zone-Redundant)',
          validationErrors: [],
          enabledOutputs: [],
        },
      },

      // ── Key Vault ────────────────────────────────────────────────────────
      {
        id: 'tmpl-kv',
        type: 'azurerm/security/key_vault',
        position: { x: 1330, y: 60 },
        parentId: 'tmpl-rg',
        data: {
          typeId: 'azurerm/security/key_vault',
          properties: {
            name: 'webapp',
            sku_name: 'standard',
            soft_delete_retention_days: 90,
            purge_protection_enabled: true,
          },
          references: {},
          terraformName: 'kv_webapp',
          label: 'Key Vault',
          validationErrors: [],
          enabledOutputs: [],
        },
      },

      // ── Storage Account (Zone-Redundant Storage) ─────────────────────────
      {
        id: 'tmpl-storage',
        type: 'azurerm/storage/storage_account',
        position: { x: 1330, y: 230 },
        parentId: 'tmpl-rg',
        data: {
          typeId: 'azurerm/storage/storage_account',
          properties: {
            name: 'webapp',
            account_tier: 'Standard',
            account_replication_type: 'ZRS',
            account_kind: 'StorageV2',
            min_tls_version: 'TLS1_2',
          },
          references: {},
          terraformName: 'st_webapp',
          label: 'Storage (ZRS)',
          validationErrors: [],
          enabledOutputs: [],
        },
      },

      // ── Private DNS Zones ────────────────────────────────────────────────
      {
        id: 'tmpl-pdz-sql',
        type: 'azurerm/networking/private_dns_zone',
        position: { x: 1600, y: 60 },
        parentId: 'tmpl-rg',
        data: {
          typeId: 'azurerm/networking/private_dns_zone',
          properties: { name: 'privatelink.database.windows.net' },
          references: {},
          terraformName: 'pdz_sql',
          label: 'DNS: SQL',
          validationErrors: [],
          enabledOutputs: [],
        },
      },
      {
        id: 'tmpl-pdz-kv',
        type: 'azurerm/networking/private_dns_zone',
        position: { x: 1600, y: 200 },
        parentId: 'tmpl-rg',
        data: {
          typeId: 'azurerm/networking/private_dns_zone',
          properties: { name: 'privatelink.vaultcore.azure.net' },
          references: {},
          terraformName: 'pdz_kv',
          label: 'DNS: Key Vault',
          validationErrors: [],
          enabledOutputs: [],
        },
      },
      {
        id: 'tmpl-pdz-storage',
        type: 'azurerm/networking/private_dns_zone',
        position: { x: 1600, y: 340 },
        parentId: 'tmpl-rg',
        data: {
          typeId: 'azurerm/networking/private_dns_zone',
          properties: { name: 'privatelink.blob.core.windows.net' },
          references: {},
          terraformName: 'pdz_storage',
          label: 'DNS: Storage',
          validationErrors: [],
          enabledOutputs: [],
        },
      },

      // ── Private DNS Zone VNet Links ──────────────────────────────────────
      {
        id: 'tmpl-vnetlink-sql',
        type: 'azurerm/networking/private_dns_zone_vnet_link',
        position: { x: 1950, y: 60 },
        parentId: 'tmpl-rg',
        data: {
          typeId: 'azurerm/networking/private_dns_zone_vnet_link',
          properties: { name: 'vnetlink-sql' },
          references: {
            private_dns_zone_id: 'tmpl-pdz-sql',
            virtual_network_id: 'tmpl-vnet',
          },
          terraformName: 'pdnsl_sql',
          label: 'VNet Link SQL',
          validationErrors: [],
          enabledOutputs: [],
        },
      },
      {
        id: 'tmpl-vnetlink-kv',
        type: 'azurerm/networking/private_dns_zone_vnet_link',
        position: { x: 1950, y: 200 },
        parentId: 'tmpl-rg',
        data: {
          typeId: 'azurerm/networking/private_dns_zone_vnet_link',
          properties: { name: 'vnetlink-kv' },
          references: {
            private_dns_zone_id: 'tmpl-pdz-kv',
            virtual_network_id: 'tmpl-vnet',
          },
          terraformName: 'pdnsl_kv',
          label: 'VNet Link KV',
          validationErrors: [],
          enabledOutputs: [],
        },
      },
      {
        id: 'tmpl-vnetlink-storage',
        type: 'azurerm/networking/private_dns_zone_vnet_link',
        position: { x: 1950, y: 340 },
        parentId: 'tmpl-rg',
        data: {
          typeId: 'azurerm/networking/private_dns_zone_vnet_link',
          properties: { name: 'vnetlink-storage' },
          references: {
            private_dns_zone_id: 'tmpl-pdz-storage',
            virtual_network_id: 'tmpl-vnet',
          },
          terraformName: 'pdnsl_storage',
          label: 'VNet Link Storage',
          validationErrors: [],
          enabledOutputs: [],
        },
      },

      // ── Monitoring ───────────────────────────────────────────────────────
      {
        id: 'tmpl-law',
        type: 'azurerm/monitoring/log_analytics_workspace',
        position: { x: 530, y: 760 },
        parentId: 'tmpl-rg',
        data: {
          typeId: 'azurerm/monitoring/log_analytics_workspace',
          properties: {
            name: 'webapp',
            sku: 'PerGB2018',
            retention_in_days: 30,
          },
          references: {},
          terraformName: 'law_webapp',
          label: 'Log Analytics',
          validationErrors: [],
          enabledOutputs: [],
        },
      },
      {
        id: 'tmpl-appi',
        type: 'azurerm/monitoring/application_insights',
        position: { x: 850, y: 760 },
        parentId: 'tmpl-rg',
        data: {
          typeId: 'azurerm/monitoring/application_insights',
          properties: {
            name: 'webapp',
            application_type: 'web',
            retention_in_days: 90,
            sampling_percentage: 100,
          },
          references: { workspace_id: 'tmpl-law' },
          terraformName: 'appi_webapp',
          label: 'Application Insights',
          validationErrors: [],
          enabledOutputs: [],
        },
      },
    ],
    edges: [],
  },
};
