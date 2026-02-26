import type { Template } from '../types';

export const microservicesKeyVaultTemplate: Template = {
  templateVersion: 1,
  metadata: {
    id: 'microservices-keyvault',
    name: 'Microservices + Key Vault',
    description:
      'Frontend and API services with shared storage and Key Vault secret management. Demonstrates output binding from Storage to Key Vault.',
    categories: ['Web Applications', 'Security'],
    icon: 'security',
  },
  diagram: {
    nodes: [
      // Subscription
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
        width: 1450,
        height: 820,
        style: 'width: 1450px; height: 820px;',
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
        width: 1350,
        height: 720,
        style: 'width: 1350px; height: 720px;',
      },
      // ── App Service Plan (holds both services) ────────────────────────────
      {
        id: 'tmpl-plan',
        type: 'azurerm/compute/app_service_plan',
        position: { x: 30, y: 60 },
        parentId: 'tmpl-rg',
        data: {
          typeId: 'azurerm/compute/app_service_plan',
          properties: {
            name: 'microservices',
            os_type: 'Linux',
            sku_name: 'B2',
          },
          references: {},
          terraformName: 'asp_1',
          label: 'App Service Plan',
          validationErrors: [],
          enabledOutputs: [],
        },
        width: 400,
        height: 360,
        style: 'width: 400px; height: 360px;',
      },
      // Frontend App Service
      {
        id: 'tmpl-frontend',
        type: 'azurerm/compute/app_service',
        position: { x: 30, y: 60 },
        parentId: 'tmpl-plan',
        data: {
          typeId: 'azurerm/compute/app_service',
          properties: {
            name: 'frontend',
            os_type: 'linux',
            runtime_stack: 'NODE|20-lts',
            https_only: true,
            always_on: true,
          },
          references: {},
          terraformName: 'app_frontend',
          label: 'Frontend',
          validationErrors: [],
          enabledOutputs: [],
        },
      },
      // API App Service
      {
        id: 'tmpl-api',
        type: 'azurerm/compute/app_service',
        position: { x: 30, y: 210 },
        parentId: 'tmpl-plan',
        data: {
          typeId: 'azurerm/compute/app_service',
          properties: {
            name: 'api',
            os_type: 'linux',
            runtime_stack: 'DOTNETCORE|8.0',
            https_only: true,
            always_on: true,
          },
          references: {},
          terraformName: 'app_api',
          label: 'API Service',
          validationErrors: [],
          enabledOutputs: [],
        },
      },
      // ── Storage Account (with output binding to Key Vault) ─────────────────
      {
        id: 'tmpl-storage',
        type: 'azurerm/storage/storage_account',
        position: { x: 530, y: 60 },
        parentId: 'tmpl-rg',
        data: {
          typeId: 'azurerm/storage/storage_account',
          properties: {
            name: 'appstorage',
            account_tier: 'Standard',
            account_replication_type: 'LRS',
            account_kind: 'StorageV2',
            min_tls_version: 'TLS1_2',
          },
          references: {},
          terraformName: 'st_1',
          label: 'App Storage',
          validationErrors: [],
          // Output enabled so the connection string can be bound to Key Vault
          enabledOutputs: ['primary_connection_string'],
        },
        width: 380,
        height: 240,
        style: 'width: 380px; height: 240px;',
      },
      // Blob Container inside storage
      {
        id: 'tmpl-blob',
        type: 'azurerm/storage/blob_container',
        position: { x: 30, y: 70 },
        parentId: 'tmpl-storage',
        data: {
          typeId: 'azurerm/storage/blob_container',
          properties: { name: 'uploads', container_access_type: 'private' },
          references: {},
          terraformName: 'blob_uploads',
          label: 'uploads',
          validationErrors: [],
          enabledOutputs: [],
        },
      },
      // ── Key Vault ──────────────────────────────────────────────────────────
      {
        id: 'tmpl-kv',
        type: 'azurerm/security/key_vault',
        position: { x: 1010, y: 60 },
        parentId: 'tmpl-rg',
        data: {
          typeId: 'azurerm/security/key_vault',
          properties: {
            name: 'secrets',
            sku_name: 'standard',
            soft_delete_retention_days: 90,
            purge_protection_enabled: false,
          },
          references: {},
          terraformName: 'kv_1',
          label: 'Key Vault',
          validationErrors: [],
          enabledOutputs: [],
        },
      },
      // ── Monitoring ────────────────────────────────────────────────────────
      {
        id: 'tmpl-law',
        type: 'azurerm/monitoring/log_analytics_workspace',
        position: { x: 30, y: 490 },
        parentId: 'tmpl-rg',
        data: {
          typeId: 'azurerm/monitoring/log_analytics_workspace',
          properties: {
            name: 'law',
            sku: 'PerGB2018',
            retention_in_days: 30,
          },
          references: {},
          terraformName: 'law_1',
          label: 'Log Analytics',
          validationErrors: [],
          enabledOutputs: [],
        },
      },
      {
        id: 'tmpl-appi',
        type: 'azurerm/monitoring/application_insights',
        position: { x: 310, y: 490 },
        parentId: 'tmpl-rg',
        data: {
          typeId: 'azurerm/monitoring/application_insights',
          properties: {
            name: 'appi',
            application_type: 'web',
            retention_in_days: 90,
            sampling_percentage: 100,
          },
          references: { workspace_id: 'tmpl-law' },
          terraformName: 'appi_1',
          label: 'Application Insights',
          validationErrors: [],
          enabledOutputs: [],
        },
      },
    ],
    edges: [
      // Storage primary_connection_string → Key Vault secret
      {
        id: 'tmpl-edge-0',
        source: 'tmpl-storage',
        target: 'tmpl-kv',
        sourceHandle: 'out-primary_connection_string',
        targetHandle: 'secret-in',
        data: {
          category: 'binding',
          label: 'Storage connection string',
        },
      },
    ],
  },
};
