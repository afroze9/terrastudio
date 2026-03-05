import type { ResourceSchema } from '@terrastudio/types';

export const loadBalancerSchema: ResourceSchema = {
  typeId: 'azurerm/networking/load_balancer',
  provider: 'azurerm',
  displayName: 'Load Balancer',
  category: 'networking',
  description: 'Azure Load Balancer for distributing traffic',
  terraformType: 'azurerm_lb',
  supportsTags: true,
  requiresResourceGroup: true,
  cafAbbreviation: 'lb',
  canBeChildOf: ['azurerm/networking/subnet'],
  parentReference: { propertyKey: 'subnet_id' },
  properties: [
    { key: 'name', label: 'Name', type: 'string', required: true, placeholder: 'lb-myapp-dev', group: 'General', order: 1 },
    { key: 'sku', label: 'SKU', type: 'select', required: true, group: 'General', order: 2, defaultValue: 'Standard', options: [{ label: 'Basic', value: 'Basic' }, { label: 'Standard', value: 'Standard' }] },
    { key: 'sku_tier', label: 'SKU Tier', type: 'select', required: false, group: 'General', order: 3, defaultValue: 'Regional', options: [{ label: 'Regional', value: 'Regional' }, { label: 'Global', value: 'Global' }] },
    { key: 'lb_type', label: 'Type', type: 'select', required: true, group: 'General', order: 4, defaultValue: 'internal', options: [{ label: 'Public', value: 'public' }, { label: 'Internal', value: 'internal' }], description: 'Public LB uses a Public IP, Internal LB uses a private IP in the subnet' },
    { key: 'frontend_name', label: 'Frontend Name', type: 'string', required: false, group: 'Frontend', order: 5, defaultValue: 'primary', description: 'Name of the frontend IP configuration' },
    { key: 'private_ip_address_allocation', label: 'Private IP Allocation', type: 'select', required: false, group: 'Frontend', order: 6, defaultValue: 'Dynamic', options: [{ label: 'Dynamic', value: 'Dynamic' }, { label: 'Static', value: 'Static' }], visibleWhen: { field: 'lb_type', operator: 'eq', value: 'internal' } },
    { key: 'public_ip_id', label: 'Public IP', type: 'reference', required: false, group: 'Frontend', order: 7, referenceTargetTypes: ['azurerm/networking/public_ip'], visibleWhen: { field: 'lb_type', operator: 'eq', value: 'public' } },
  ],
  handles: [
    { id: 'lb-backend-out', type: 'source', position: 'bottom', label: 'Backend Pool' },
  ],
  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
    { key: 'private_ip_address', label: 'Private IP Address', terraformAttribute: 'private_ip_address' },
    { key: 'frontend_ip_configuration_id', label: 'Frontend IP Config ID', terraformAttribute: 'frontend_ip_configuration[0].id' },
  ],
};
