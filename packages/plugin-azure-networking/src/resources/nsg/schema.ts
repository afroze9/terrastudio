import type { ResourceSchema } from '@terrastudio/types';

export const nsgSchema: ResourceSchema = {
  typeId: 'azurerm/networking/network_security_group',
  provider: 'azurerm',
  displayName: 'Network Security Group',
  category: 'networking',
  description: 'Azure Network Security Group (NSG) for filtering network traffic',
  terraformType: 'azurerm_network_security_group',
  supportsTags: true,
  requiresResourceGroup: true,
  cafAbbreviation: 'nsg',
  namingConstraints: { maxLength: 80 },
  canBeChildOf: [
    'azurerm/core/resource_group',
  ],

  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'my-nsg',
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
      key: 'security_rules',
      label: 'Security Rules',
      type: 'array',
      required: false,
      description: 'Inbound and outbound security rules',
      group: 'Rules',
      order: 2,
      itemSchema: {
        key: 'rule',
        label: 'Security Rule',
        type: 'object',
        required: true,
        nestedSchema: [
          {
            key: 'name',
            label: 'Rule Name',
            type: 'string',
            required: true,
            placeholder: 'allow-ssh',
          },
          {
            key: 'priority',
            label: 'Priority',
            type: 'number',
            required: true,
            placeholder: '100',
            validation: { min: 100, max: 4096 },
          },
          {
            key: 'direction',
            label: 'Direction',
            type: 'select',
            required: true,
            options: [
              { label: 'Inbound', value: 'Inbound' },
              { label: 'Outbound', value: 'Outbound' },
            ],
          },
          {
            key: 'access',
            label: 'Access',
            type: 'select',
            required: true,
            options: [
              { label: 'Allow', value: 'Allow' },
              { label: 'Deny', value: 'Deny' },
            ],
          },
          {
            key: 'protocol',
            label: 'Protocol',
            type: 'select',
            required: true,
            options: [
              { label: 'TCP', value: 'Tcp' },
              { label: 'UDP', value: 'Udp' },
              { label: 'ICMP', value: 'Icmp' },
              { label: 'Any', value: '*' },
            ],
          },
          {
            key: 'source_port_range',
            label: 'Source Port Range',
            type: 'string',
            required: true,
            defaultValue: '*',
          },
          {
            key: 'destination_port_range',
            label: 'Destination Port Range',
            type: 'string',
            required: true,
            placeholder: '22',
          },
          {
            key: 'source_address_prefix',
            label: 'Source Address Prefix',
            type: 'string',
            required: true,
            defaultValue: '*',
          },
          {
            key: 'destination_address_prefix',
            label: 'Destination Address Prefix',
            type: 'string',
            required: true,
            defaultValue: '*',
          },
        ],
      },
    },
  ],

  handles: [],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
  ],
};
