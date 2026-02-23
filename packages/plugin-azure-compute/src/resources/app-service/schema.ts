import type { ResourceSchema } from '@terrastudio/types';

export const appServiceSchema: ResourceSchema = {
  typeId: 'azurerm/compute/app_service',
  provider: 'azurerm',
  displayName: 'App Service',
  category: 'compute',
  description: 'Azure App Service (Web App) for hosting web applications',
  terraformType: 'azurerm_linux_web_app',
  supportsTags: true,
  requiresResourceGroup: true,
  cafAbbreviation: 'app',
  namingConstraints: { maxLength: 60 },
  canBeChildOf: ['azurerm/compute/app_service_plan'],

  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'app-mywebapp-dev',
      group: 'General',
      order: 1,
      validation: {
        minLength: 2,
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
      defaultValue: 'linux',
      description: 'Must match the App Service Plan OS type',
      options: [
        { label: 'Linux', value: 'linux' },
        { label: 'Windows', value: 'windows' },
      ],
    },
    {
      key: 'runtime_stack',
      label: 'Runtime Stack',
      type: 'select',
      required: false,
      group: 'Runtime',
      order: 3,
      defaultValue: 'NODE|18-lts',
      options: [
        { label: 'Node.js 18 LTS', value: 'NODE|18-lts' },
        { label: 'Node.js 20 LTS', value: 'NODE|20-lts' },
        { label: 'Python 3.11', value: 'PYTHON|3.11' },
        { label: 'Python 3.12', value: 'PYTHON|3.12' },
        { label: '.NET 8', value: 'DOTNETCORE|8.0' },
        { label: 'Java 17', value: 'JAVA|17-java17' },
        { label: 'PHP 8.2', value: 'PHP|8.2' },
      ],
    },
    {
      key: 'always_on',
      label: 'Always On',
      type: 'boolean',
      required: false,
      group: 'Configuration',
      order: 4,
      defaultValue: false,
      description: 'Keep the app loaded even when idle (requires Basic tier or higher)',
    },
    {
      key: 'https_only',
      label: 'HTTPS Only',
      type: 'boolean',
      required: false,
      group: 'Security',
      order: 5,
      defaultValue: true,
    },
  ],

  parentReference: { propertyKey: 'service_plan_id' },

  handles: [],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
    { key: 'default_hostname', label: 'Default Hostname', terraformAttribute: 'default_hostname' },
    { key: 'outbound_ip_addresses', label: 'Outbound IPs', terraformAttribute: 'outbound_ip_addresses' },
  ],
};
