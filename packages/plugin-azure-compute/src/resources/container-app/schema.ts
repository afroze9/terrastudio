import type { ResourceSchema } from '@terrastudio/types';

export const containerAppSchema: ResourceSchema = {
  typeId: 'azurerm/containers/container_app',
  provider: 'azurerm',
  displayName: 'Container App',
  category: 'containers',
  description: 'Azure Container App running in a Container App Environment',
  terraformType: 'azurerm_container_app',
  supportsTags: true,
  requiresResourceGroup: true,
  cafAbbreviation: 'ca',
  canBeChildOf: ['azurerm/containers/container_app_environment'],
  parentReference: { propertyKey: 'container_app_environment_id' },
  properties: [
    { key: 'name', label: 'Name', type: 'string', required: true, placeholder: 'ca-myapp-dev', group: 'General', order: 1 },
    { key: 'revision_mode', label: 'Revision Mode', type: 'select', required: true, group: 'General', order: 2, defaultValue: 'Single', options: [{ label: 'Single', value: 'Single' }, { label: 'Multiple', value: 'Multiple' }] },
    { key: 'container_image', label: 'Container Image', type: 'string', required: true, placeholder: 'mcr.microsoft.com/k8se/quickstart:latest', group: 'Container', order: 3 },
    { key: 'container_cpu', label: 'CPU (cores)', type: 'select', required: false, group: 'Container', order: 4, defaultValue: '0.25', options: [{ label: '0.25', value: '0.25' }, { label: '0.5', value: '0.5' }, { label: '1.0', value: '1.0' }, { label: '2.0', value: '2.0' }] },
    { key: 'container_memory', label: 'Memory', type: 'select', required: false, group: 'Container', order: 5, defaultValue: '0.5Gi', options: [{ label: '0.5 Gi', value: '0.5Gi' }, { label: '1.0 Gi', value: '1.0Gi' }, { label: '2.0 Gi', value: '2.0Gi' }, { label: '4.0 Gi', value: '4.0Gi' }] },
    { key: 'ingress_enabled', label: 'Enable Ingress', type: 'boolean', required: false, group: 'Ingress', order: 6, defaultValue: false },
    { key: 'ingress_target_port', label: 'Target Port', type: 'number', required: false, group: 'Ingress', order: 7, defaultValue: 80, visibleWhen: { field: 'ingress_enabled', operator: 'truthy' } },
    { key: 'ingress_external', label: 'External Traffic', type: 'boolean', required: false, group: 'Ingress', order: 8, defaultValue: true, visibleWhen: { field: 'ingress_enabled', operator: 'truthy' }, description: 'Allow external traffic' },
  ],
  handles: [],
  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
    { key: 'latest_revision_fqdn', label: 'Latest Revision FQDN', terraformAttribute: 'latest_revision_fqdn' },
    { key: 'outbound_ip_addresses', label: 'Outbound IPs', terraformAttribute: 'outbound_ip_addresses' },
  ],
};
