import type { InfraPlugin, ResourceTypeId, ResourceTypeRegistration } from '@terrastudio/types';
import { logAnalyticsWorkspaceRegistration } from './resources/log-analytics-workspace/index.js';
import { applicationInsightsRegistration } from './resources/application-insights/index.js';
import { monitoringConnectionRules } from './connections/rules.js';

const resourceTypes = new Map<ResourceTypeId, ResourceTypeRegistration>([
  ['azurerm/monitoring/log_analytics_workspace', logAnalyticsWorkspaceRegistration],
  ['azurerm/monitoring/application_insights', applicationInsightsRegistration],
]);

const plugin: InfraPlugin = {
  id: '@terrastudio/plugin-azure-monitoring',
  name: 'Azure Monitoring',
  version: '0.1.0',
  providerId: 'azurerm',

  resourceTypes,
  connectionRules: monitoringConnectionRules,

  paletteCategories: [
    {
      id: 'monitoring',
      label: 'Monitoring',
      order: 45,
    },
  ],
};

export default plugin;
