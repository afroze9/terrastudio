import type { InfraPlugin, ResourceTypeId, ResourceTypeRegistration } from '@terrastudio/types';
import { awsProviderConfig } from './provider-config.js';
import { vpcRegistration } from './resources/vpc/index.js';
import { subnetRegistration } from './resources/subnet/index.js';
import { internetGatewayRegistration } from './resources/internet-gateway/index.js';
import { natGatewayRegistration } from './resources/nat-gateway/index.js';
import { routeTableRegistration } from './resources/route-table/index.js';

const resourceTypes = new Map<ResourceTypeId, ResourceTypeRegistration>([
  ['aws/networking/vpc', vpcRegistration],
  ['aws/networking/subnet', subnetRegistration],
  ['aws/networking/internet_gateway', internetGatewayRegistration],
  ['aws/networking/nat_gateway', natGatewayRegistration],
  ['aws/networking/route_table', routeTableRegistration],
]);

const plugin: InfraPlugin = {
  id: '@terrastudio/plugin-aws-networking',
  name: 'AWS Networking',
  version: '0.1.0',
  providerId: 'aws',
  providerConfig: awsProviderConfig,
  resourceTypes,
  connectionRules: [],
  paletteCategories: [
    {
      id: 'aws-networking',
      label: 'Networking',
      order: 110,
    },
  ],
};

export default plugin;
