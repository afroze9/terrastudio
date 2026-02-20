import type { ResourceSchema } from '@terrastudio/types';

export const appServicePlanSchema: ResourceSchema = {
  typeId: 'azurerm/compute/app_service_plan',
  provider: 'azurerm',
  displayName: 'App Service Plan',
  category: 'compute',
  description: 'Azure App Service Plan — hosting environment for web apps',
  terraformType: 'azurerm_service_plan',
  supportsTags: true,
  requiresResourceGroup: true,
  canBeChildOf: [
    'azurerm/core/resource_group',
  ],

  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'asp-myapp-dev',
      group: 'General',
      order: 1,
      validation: {
        minLength: 1,
        maxLength: 60,
        pattern: '^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$',
        patternMessage: 'Alphanumerics and hyphens, must start and end with alphanumeric',
      },
    },
    {
      key: 'os_type',
      label: 'OS Type',
      type: 'select',
      required: true,
      group: 'General',
      order: 2,
      defaultValue: 'Linux',
      options: [
        { label: 'Linux', value: 'Linux' },
        { label: 'Windows', value: 'Windows' },
      ],
    },
    {
      key: 'sku_name',
      label: 'SKU',
      type: 'select',
      required: true,
      group: 'General',
      order: 3,
      defaultValue: 'B1',
      options: [
        { label: 'F1 (Free)', value: 'F1' },
        { label: 'B1 (Basic)', value: 'B1' },
        { label: 'B2 (Basic)', value: 'B2' },
        { label: 'B3 (Basic)', value: 'B3' },
        { label: 'S1 (Standard)', value: 'S1' },
        { label: 'S2 (Standard)', value: 'S2' },
        { label: 'S3 (Standard)', value: 'S3' },
        { label: 'P1v3 (Premium v3)', value: 'P1v3' },
        { label: 'P2v3 (Premium v3)', value: 'P2v3' },
        { label: 'P3v3 (Premium v3)', value: 'P3v3' },
      ],
    },
  ],

  handles: [
    {
      id: 'apps-out',
      type: 'source',
      position: 'right',
      label: 'Apps',
    },
  ],
};
