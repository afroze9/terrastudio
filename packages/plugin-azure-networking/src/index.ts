import type { InfraPlugin, ResourceTypeId, ResourceTypeRegistration } from '@terrastudio/types';
import { azurermProviderConfig } from './provider-config.js';
import { vnetRegistration } from './resources/vnet/index.js';
import { subnetRegistration } from './resources/subnet/index.js';
import { nsgRegistration } from './resources/nsg/index.js';
import { publicIpRegistration } from './resources/public-ip/index.js';
import { privateDnsZoneRegistration } from './resources/private-dns-zone/index.js';
import { privateDnsZoneVnetLinkRegistration } from './resources/private-dns-zone-vnet-link/index.js';
import { privateEndpointRegistration } from './resources/private-endpoint/index.js';
import { networkingConnectionRules } from './connections/rules.js';

const resourceTypes = new Map<ResourceTypeId, ResourceTypeRegistration>([
  ['azurerm/networking/virtual_network', vnetRegistration],
  ['azurerm/networking/subnet', subnetRegistration],
  ['azurerm/networking/network_security_group', nsgRegistration],
  ['azurerm/networking/public_ip', publicIpRegistration],
  ['azurerm/networking/private_dns_zone', privateDnsZoneRegistration],
  ['azurerm/networking/private_dns_zone_vnet_link', privateDnsZoneVnetLinkRegistration],
  ['azurerm/networking/private_endpoint', privateEndpointRegistration],
]);

const plugin: InfraPlugin = {
  id: '@terrastudio/plugin-azure-networking',
  name: 'Azure Networking',
  version: '0.1.0',
  providerId: 'azurerm',

  providerConfig: azurermProviderConfig,
  resourceTypes,
  connectionRules: networkingConnectionRules,

  paletteCategories: [
    {
      id: 'networking',
      label: 'Networking',
      order: 10,
    },
  ],
};

export default plugin;
