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
import { firewallRegistration } from './resources/firewall/index.js';
import { vpnGatewayRegistration } from './resources/vpn-gateway/index.js';
import { applicationGatewayRegistration } from './resources/application-gateway/index.js';
import { loadBalancerRegistration } from './resources/load-balancer/index.js';
import { dnsZoneRegistration } from './resources/dns-zone/index.js';
import { dnsARecordRegistration } from './resources/dns-a-record/index.js';
import { dnsCnameRecordRegistration } from './resources/dns-cname-record/index.js';
import { vnetPeeringRegistration } from './resources/vnet-peering/index.js';
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
  ['azurerm/networking/firewall', firewallRegistration],
  ['azurerm/networking/virtual_network_gateway', vpnGatewayRegistration],
  ['azurerm/networking/application_gateway', applicationGatewayRegistration],
  ['azurerm/networking/load_balancer', loadBalancerRegistration],
  ['azurerm/dns/dns_zone', dnsZoneRegistration],
  ['azurerm/dns/dns_a_record', dnsARecordRegistration],
  ['azurerm/dns/dns_cname_record', dnsCnameRecordRegistration],
  ['azurerm/networking/virtual_network_peering', vnetPeeringRegistration],
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
    {
      id: 'dns',
      label: 'DNS',
      order: 12,
    },
  ],
};

export default plugin;
