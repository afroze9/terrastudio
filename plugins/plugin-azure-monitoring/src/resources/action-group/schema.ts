import type { ResourceSchema } from '@terrastudio/types';

export const actionGroupSchema: ResourceSchema = {
  typeId: 'azurerm/monitoring/action_group',
  provider: 'azurerm',
  displayName: 'Action Group',
  category: 'monitoring',
  description: 'Azure Monitor action group — notifications fired by metric and log alerts',
  terraformType: 'azurerm_monitor_action_group',
  supportsTags: true,
  requiresResourceGroup: true,
  cafAbbreviation: 'ag',
  namingConstraints: { maxLength: 260 },

  canBeChildOf: [
    'azurerm/core/resource_group',
  ],

  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'ag-myapp-ops',
      group: 'General',
      order: 1,
      validation: {
        minLength: 1,
        maxLength: 260,
      },
    },
    {
      key: 'short_name',
      label: 'Short Name',
      type: 'string',
      required: true,
      placeholder: 'myapp-ops',
      group: 'General',
      order: 2,
      description: 'Displayed in SMS messages; max 12 chars',
      validation: {
        minLength: 1,
        maxLength: 12,
      },
    },
    {
      key: 'enabled',
      label: 'Enabled',
      type: 'boolean',
      required: false,
      group: 'General',
      order: 3,
      defaultValue: true,
    },
    {
      key: 'email_receivers',
      label: 'Email Receivers',
      type: 'array',
      required: false,
      group: 'Email',
      order: 10,
      itemSchema: {
        key: 'receiver',
        label: 'Email Receiver',
        type: 'object',
        required: true,
        nestedSchema: [
          { key: 'name', label: 'Name', type: 'string', required: true, placeholder: 'oncall-email' },
          { key: 'email_address', label: 'Email Address', type: 'string', required: true, placeholder: 'oncall@example.com' },
          { key: 'use_common_alert_schema', label: 'Common Alert Schema', type: 'boolean', required: false, defaultValue: true },
        ],
      },
    },
    {
      key: 'sms_receivers',
      label: 'SMS Receivers',
      type: 'array',
      required: false,
      group: 'SMS',
      order: 20,
      itemSchema: {
        key: 'receiver',
        label: 'SMS Receiver',
        type: 'object',
        required: true,
        nestedSchema: [
          { key: 'name', label: 'Name', type: 'string', required: true, placeholder: 'oncall-sms' },
          { key: 'country_code', label: 'Country Code', type: 'string', required: true, placeholder: '1' },
          { key: 'phone_number', label: 'Phone Number', type: 'string', required: true, placeholder: '5555550123' },
        ],
      },
    },
    {
      key: 'webhook_receivers',
      label: 'Webhook Receivers',
      type: 'array',
      required: false,
      group: 'Webhooks',
      order: 30,
      itemSchema: {
        key: 'receiver',
        label: 'Webhook Receiver',
        type: 'object',
        required: true,
        nestedSchema: [
          { key: 'name', label: 'Name', type: 'string', required: true, placeholder: 'teams-webhook' },
          { key: 'service_uri', label: 'Service URI', type: 'string', required: true, placeholder: 'https://...' },
          { key: 'use_common_alert_schema', label: 'Common Alert Schema', type: 'boolean', required: false, defaultValue: true },
        ],
      },
    },
  ],

  handles: [],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
  ],

  costEstimation: { serviceName: 'Action Group', staticMonthlyCost: 0 },
};
