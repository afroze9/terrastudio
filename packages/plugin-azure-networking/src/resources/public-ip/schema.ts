import type { ResourceSchema } from '@terrastudio/types';

export const publicIpSchema: ResourceSchema = {
  typeId: 'azurerm/networking/public_ip',
  provider: 'azurerm',
  displayName: 'Public IP',
  category: 'networking',
  description: 'Azure Public IP address for internet-facing resources',
  terraformType: 'azurerm_public_ip',
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
      placeholder: 'pip-myapp-dev',
      group: 'General',
      order: 1,
      validation: {
        minLength: 1,
        maxLength: 80,
        pattern: '^[a-zA-Z0-9][a-zA-Z0-9_.-]*[a-zA-Z0-9_]$',
        patternMessage: 'Must start with alphanumeric, end with alphanumeric or underscore',
      },
    },
    {
      key: 'allocation_method',
      label: 'Allocation Method',
      type: 'select',
      required: true,
      group: 'General',
      order: 2,
      defaultValue: 'Static',
      options: [
        { label: 'Static', value: 'Static' },
        { label: 'Dynamic', value: 'Dynamic' },
      ],
    },
    {
      key: 'sku',
      label: 'SKU',
      type: 'select',
      required: true,
      group: 'General',
      order: 3,
      defaultValue: 'Standard',
      options: [
        { label: 'Basic', value: 'Basic' },
        { label: 'Standard', value: 'Standard' },
      ],
    },
    {
      key: 'ip_version',
      label: 'IP Version',
      type: 'select',
      required: false,
      group: 'Advanced',
      order: 4,
      defaultValue: 'IPv4',
      options: [
        { label: 'IPv4', value: 'IPv4' },
        { label: 'IPv6', value: 'IPv6' },
      ],
    },
    {
      key: 'idle_timeout_in_minutes',
      label: 'Idle Timeout (min)',
      type: 'number',
      required: false,
      group: 'Advanced',
      order: 5,
      defaultValue: 4,
      validation: {
        min: 4,
        max: 30,
      },
    },
    {
      key: 'domain_name_label',
      label: 'Domain Name Label',
      type: 'string',
      required: false,
      group: 'Advanced',
      order: 6,
      placeholder: 'myapp',
      description: 'Creates a DNS record: <label>.<region>.cloudapp.azure.com',
    },
  ],

  handles: [],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
    { key: 'ip_address', label: 'IP Address', terraformAttribute: 'ip_address' },
    { key: 'fqdn', label: 'FQDN', terraformAttribute: 'fqdn' },
  ],
};
