import type { InfraPlugin, ResourceTypeId, ResourceTypeRegistration } from '@terrastudio/types';
import { azurermProviderConfig } from './provider-config.js';
import { vnetRegistration } from './resources/vnet/index.js';
import { subnetRegistration } from './resources/subnet/index.js';
import { nsgRegistration } from './resources/nsg/index.js';
import { publicIpRegistration } from './resources/public-ip/index.js';
import { privateDnsZoneRegistration } from './resources/private-dns-zone/index.js';
import { privateDnsZoneVnetLinkRegistration } from './resources/private-dns-zone-vnet-link/index.js';
import { privateEndpointRegistration } from './resources/private-endpoint/index.js';
import { routeTableRegistration } from './resources/route-table/index.js';
import { routeRegistration } from './resources/route/index.js';
import { natGatewayRegistration } from './resources/nat-gateway/index.js';
import { bastionRegistration } from './resources/bastion/index.js';
import { vnetIntegrationRegistration } from './resources/vnet-integration/index.js';
import { networkingConnectionRules } from './connections/rules.js';

const resourceTypes = new Map<ResourceTypeId, ResourceTypeRegistration>([
  ['azurerm/networking/virtual_network', vnetRegistration],
  ['azurerm/networking/subnet', subnetRegistration],
  ['azurerm/networking/network_security_group', nsgRegistration],
  ['azurerm/networking/public_ip', publicIpRegistration],
  ['azurerm/networking/private_dns_zone', privateDnsZoneRegistration],
  ['azurerm/networking/private_dns_zone_vnet_link', privateDnsZoneVnetLinkRegistration],
  ['azurerm/networking/private_endpoint', privateEndpointRegistration],
  ['azurerm/networking/route_table', routeTableRegistration],
  ['azurerm/networking/route', routeRegistration],
  ['azurerm/networking/nat_gateway', natGatewayRegistration],
  ['azurerm/networking/bastion_host', bastionRegistration],
  ['azurerm/networking/vnet_integration', vnetIntegrationRegistration],
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
