import type { ResourceSchema } from '@terrastudio/types';

export const privateDnsZoneVnetLinkSchema: ResourceSchema = {
  typeId: 'azurerm/networking/private_dns_zone_vnet_link',
  provider: 'azurerm',
  displayName: 'DNS Zone VNet Link',
  category: 'networking',
  description: 'Links a Private DNS Zone to a Virtual Network for name resolution',
  terraformType: 'azurerm_private_dns_zone_virtual_network_link',
  supportsTags: true,
  requiresResourceGroup: true,
  cafAbbreviation: 'pdnsl',

  canBeChildOf: [
    'azurerm/core/resource_group',
  ],

  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'pdnsl-vnet-link',
      group: 'General',
      order: 1,
      validation: {
        minLength: 1,
        maxLength: 80,
      },
    },
    {
      key: 'private_dns_zone_id',
      label: 'Private DNS Zone',
      type: 'reference',
      required: true,
      group: 'General',
      order: 2,
      description: 'The Private DNS Zone to link',
      referenceTargetTypes: [
        'azurerm/networking/private_dns_zone',
      ],
    },
    {
      key: 'virtual_network_id',
      label: 'Virtual Network',
      type: 'reference',
      required: true,
      group: 'General',
      order: 3,
      description: 'The VNet to link for DNS resolution',
      referenceTargetTypes: [
        'azurerm/networking/virtual_network',
      ],
    },
    {
      key: 'registration_enabled',
      label: 'Auto-Registration',
      type: 'boolean',
      required: false,
      group: 'Advanced',
      order: 4,
      defaultValue: false,
      description: 'Enable auto-registration of VM DNS records in this zone',
    },
  ],

  handles: [],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
  ],
};
