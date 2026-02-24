import type { ResourceSchema } from '@terrastudio/types';

export const applicationInsightsSchema: ResourceSchema = {
  typeId: 'azurerm/monitoring/application_insights',
  provider: 'azurerm',
  displayName: 'Application Insights',
  category: 'monitoring',
  description: 'Azure Application Insights for application performance monitoring',
  terraformType: 'azurerm_application_insights',
  supportsTags: true,
  requiresResourceGroup: true,
  cafAbbreviation: 'appi',

  canBeChildOf: [
    'azurerm/core/resource_group',
  ],

  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'appi-myapp-dev',
      group: 'General',
      order: 1,
      validation: {
        minLength: 1,
        maxLength: 260,
      },
    },
    {
      key: 'application_type',
      label: 'Application Type',
      type: 'select',
      required: true,
      group: 'General',
      order: 2,
      defaultValue: 'web',
      options: [
        { label: 'Web', value: 'web' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      key: 'workspace_id',
      label: 'Log Analytics Workspace',
      type: 'reference',
      required: false,
      group: 'Workspace',
      order: 3,
      referenceTargetTypes: ['azurerm/monitoring/log_analytics_workspace'],
      description: 'Log Analytics Workspace for data storage (recommended)',
      showAsEdge: true,
    },
    {
      key: 'retention_in_days',
      label: 'Retention (days)',
      type: 'number',
      required: false,
      group: 'Advanced',
      order: 4,
      defaultValue: 90,
      validation: {
        min: 30,
        max: 730,
      },
    },
    {
      key: 'daily_data_cap_in_gb',
      label: 'Daily Data Cap (GB)',
      type: 'number',
      required: false,
      group: 'Advanced',
      order: 5,
      description: 'Daily data volume cap for cost control',
    },
    {
      key: 'sampling_percentage',
      label: 'Sampling %',
      type: 'number',
      required: false,
      group: 'Advanced',
      order: 6,
      defaultValue: 100,
      validation: {
        min: 0,
        max: 100,
      },
    },
  ],

  handles: [],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
    { key: 'instrumentation_key', label: 'Instrumentation Key', terraformAttribute: 'instrumentation_key', sensitive: true },
    { key: 'connection_string', label: 'Connection String', terraformAttribute: 'connection_string', sensitive: true },
  ],
};
