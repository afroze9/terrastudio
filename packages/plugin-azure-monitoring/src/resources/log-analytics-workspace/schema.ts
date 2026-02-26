import type { ResourceSchema } from '@terrastudio/types';

export const logAnalyticsWorkspaceSchema: ResourceSchema = {
  typeId: 'azurerm/monitoring/log_analytics_workspace',
  provider: 'azurerm',
  displayName: 'Log Analytics Workspace',
  category: 'monitoring',
  description: 'Azure Log Analytics Workspace for centralized log collection and analysis',
  terraformType: 'azurerm_log_analytics_workspace',
  supportsTags: true,
  requiresResourceGroup: true,
  cafAbbreviation: 'log',
  namingConstraints: { maxLength: 63 },

  canBeChildOf: [
    'azurerm/core/resource_group',
  ],

  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'log-myapp-dev',
      group: 'General',
      order: 1,
      validation: {
        minLength: 4,
        maxLength: 63,
        pattern: '^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$',
        patternMessage: 'Letters, digits, or hyphens; cannot start or end with hyphen',
      },
    },
    {
      key: 'sku',
      label: 'Pricing Tier',
      type: 'select',
      required: true,
      group: 'General',
      order: 2,
      defaultValue: 'PerGB2018',
      options: [
        { label: 'Pay-as-you-go (PerGB2018)', value: 'PerGB2018' },
        { label: 'Free', value: 'Free' },
        { label: 'Standalone', value: 'Standalone' },
        { label: 'Per Node', value: 'PerNode' },
      ],
    },
    {
      key: 'retention_in_days',
      label: 'Retention (days)',
      type: 'number',
      required: false,
      group: 'General',
      order: 3,
      defaultValue: 30,
      validation: {
        min: 30,
        max: 730,
      },
    },
    {
      key: 'daily_quota_gb',
      label: 'Daily Quota (GB)',
      type: 'number',
      required: false,
      group: 'Advanced',
      order: 4,
      defaultValue: -1,
      description: '-1 means unlimited ingestion',
    },
  ],

  handles: [
    {
      id: 'pep-target',
      type: 'target',
      position: 'left',
      label: 'Private Endpoint',
    },
  ],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
    { key: 'workspace_id', label: 'Workspace ID', terraformAttribute: 'workspace_id' },
    { key: 'primary_shared_key', label: 'Primary Shared Key', terraformAttribute: 'primary_shared_key', sensitive: true },
  ],
};
