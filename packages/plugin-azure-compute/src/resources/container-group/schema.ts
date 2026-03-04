import type { ResourceSchema } from '@terrastudio/types';

export const containerGroupSchema: ResourceSchema = {
  typeId: 'azurerm/containers/container_group',
  provider: 'azurerm',
  displayName: 'Container Instances',
  category: 'containers',
  description: 'Azure Container Instances (ACI) container group',
  terraformType: 'azurerm_container_group',
  supportsTags: true,
  requiresResourceGroup: true,
  cafAbbreviation: 'ci',
  canBeChildOf: ['azurerm/core/resource_group', 'azurerm/networking/subnet'],
  visualContainment: true,
  properties: [
    { key: 'name', label: 'Name', type: 'string', required: true, placeholder: 'ci-myapp-dev', group: 'General', order: 1 },
    { key: 'os_type', label: 'OS Type', type: 'select', required: true, group: 'General', order: 2, defaultValue: 'Linux', options: [{ label: 'Linux', value: 'Linux' }, { label: 'Windows', value: 'Windows' }] },
    { key: 'container_image', label: 'Container Image', type: 'string', required: true, placeholder: 'mcr.microsoft.com/azuredocs/aci-helloworld:latest', group: 'Container', order: 3 },
    { key: 'container_cpu', label: 'CPU (cores)', type: 'select', required: false, group: 'Container', order: 4, defaultValue: '1', options: [{ label: '0.5', value: '0.5' }, { label: '1', value: '1' }, { label: '2', value: '2' }, { label: '4', value: '4' }] },
    { key: 'container_memory', label: 'Memory (GB)', type: 'select', required: false, group: 'Container', order: 5, defaultValue: '1.5', options: [{ label: '0.5', value: '0.5' }, { label: '1', value: '1' }, { label: '1.5', value: '1.5' }, { label: '2', value: '2' }, { label: '4', value: '4' }] },
    { key: 'container_port', label: 'Container Port', type: 'number', required: false, group: 'Networking', order: 6, defaultValue: 80 },
    { key: 'ip_address_type', label: 'IP Address Type', type: 'select', required: false, group: 'Networking', order: 7, defaultValue: 'Public', options: [{ label: 'Public', value: 'Public' }, { label: 'Private', value: 'Private' }, { label: 'None', value: 'None' }] },
    { key: 'dns_name_label', label: 'DNS Name Label', type: 'string', required: false, group: 'Networking', order: 8, visibleWhen: { field: 'ip_address_type', operator: 'eq', value: 'Public' } },
    { key: 'restart_policy', label: 'Restart Policy', type: 'select', required: false, group: 'General', order: 9, defaultValue: 'Always', options: [{ label: 'Always', value: 'Always' }, { label: 'Never', value: 'Never' }, { label: 'On Failure', value: 'OnFailure' }] },
  ],
  handles: [],
  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
    { key: 'ip_address', label: 'IP Address', terraformAttribute: 'ip_address' },
    { key: 'fqdn', label: 'FQDN', terraformAttribute: 'fqdn' },
  ],
};
