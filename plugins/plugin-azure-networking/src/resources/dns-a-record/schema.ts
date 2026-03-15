import type { ResourceSchema } from '@terrastudio/types';

export const dnsARecordSchema: ResourceSchema = {
  typeId: 'azurerm/dns/dns_a_record',
  provider: 'azurerm',
  displayName: 'DNS A Record',
  category: 'dns',
  description: 'DNS A record mapping a hostname to IPv4 addresses',
  terraformType: 'azurerm_dns_a_record',
  supportsTags: true,
  requiresResourceGroup: true,
  cafAbbreviation: 'dnsa',
  canBeChildOf: ['azurerm/dns/dns_zone'],
  parentReference: { propertyKey: 'dns_zone_id' },
  properties: [
    { key: 'name', label: 'Record Name', type: 'string', required: true, placeholder: 'www', group: 'General', order: 1,
      description: 'Subdomain name (e.g. "www", "@" for root)',
      validation: { minLength: 1, maxLength: 80 } },
    { key: 'ttl', label: 'TTL (seconds)', type: 'number', required: false, group: 'General', order: 2, defaultValue: 3600,
      validation: { min: 1, max: 2147483647 } },
    { key: 'record_mode', label: 'Record Mode', type: 'select', required: true, group: 'Record', order: 4, defaultValue: 'ip',
      options: [
        { label: 'IP Addresses', value: 'ip' },
        { label: 'Target Resource (alias)', value: 'alias' },
      ] },
    { key: 'records', label: 'IP Addresses', type: 'array', required: false, group: 'Record', order: 5,
      description: 'List of IPv4 addresses',
      visibleWhen: { field: 'record_mode', operator: 'eq', value: 'ip' },
      itemSchema: { key: 'ip', label: 'IP Address', type: 'string', required: true, placeholder: '10.0.0.1' } },
    { key: 'target_resource_id', label: 'Target Resource', type: 'reference', required: false, group: 'Record', order: 6,
      description: 'Azure resource to alias (e.g., Public IP)',
      referenceTargetTypes: ['azurerm/networking/public_ip'],
      visibleWhen: { field: 'record_mode', operator: 'eq', value: 'alias' },
      showAsEdge: true },
  ],
  handles: [],
  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
    { key: 'fqdn', label: 'FQDN', terraformAttribute: 'fqdn' },
  ],

  costEstimation: { serviceName: 'DNS', staticMonthlyCost: 0 },
};
