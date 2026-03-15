import type { ResourceSchema } from '@terrastudio/types';

export const containerAppEnvironmentSchema: ResourceSchema = {
  typeId: 'azurerm/containers/container_app_environment',
  provider: 'azurerm',
  displayName: 'Container App Environment',
  category: 'containers',
  description: 'Azure Container Apps managed environment',
  terraformType: 'azurerm_container_app_environment',
  supportsTags: true,
  requiresResourceGroup: true,
  cafAbbreviation: 'cae',
  namingConstraints: { maxLength: 64 },
  isContainer: true,
  canBeChildOf: ['azurerm/core/resource_group', 'azurerm/networking/subnet'],
  visualContainment: true,
  containerStyle: {
    borderColor: '#00796B',
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
    { key: 'name', label: 'Name', type: 'string', required: true, placeholder: 'cae-myapp-dev', group: 'General', order: 1, validation: { minLength: 1, maxLength: 64 } },
    { key: 'log_analytics_workspace_id', label: 'Log Analytics Workspace', type: 'reference', required: false, group: 'Monitoring', order: 2, referenceTargetTypes: ['azurerm/monitoring/log_analytics_workspace'], description: 'Log Analytics workspace for container app logs' },
    { key: 'zone_redundancy_enabled', label: 'Zone Redundancy', type: 'boolean', required: false, group: 'Availability', order: 3, defaultValue: false, description: 'Enable zone redundancy for high availability' },
    { key: 'internal_load_balancer_enabled', label: 'Internal Load Balancer', type: 'boolean', required: false, group: 'Networking', order: 4, defaultValue: false, description: 'Use internal load balancer (no public ingress)' },
  ],
  handles: [],
  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
    { key: 'default_domain', label: 'Default Domain', terraformAttribute: 'default_domain' },
    { key: 'static_ip_address', label: 'Static IP', terraformAttribute: 'static_ip_address' },
  ],

  costEstimation: {
    serviceName: 'Container Apps',
    skuProperty: 'sku_name',
  },
};
