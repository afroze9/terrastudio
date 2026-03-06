import type { InfraPlugin, ResourceTypeId, ResourceTypeRegistration } from '@terrastudio/types';
import { securityGroupRegistration } from './resources/security-group/index.js';
import { ec2InstanceRegistration } from './resources/ec2-instance/index.js';
import { eipRegistration } from './resources/eip/index.js';
import { albRegistration } from './resources/alb/index.js';
import { rdsInstanceRegistration } from './resources/rds-instance/index.js';
import { computeConnectionRules } from './connections/rules.js';

const resourceTypes = new Map<ResourceTypeId, ResourceTypeRegistration>([
  ['aws/compute/security_group', securityGroupRegistration],
  ['aws/compute/instance', ec2InstanceRegistration],
  ['aws/compute/eip', eipRegistration],
  ['aws/compute/alb', albRegistration],
  ['aws/compute/rds_instance', rdsInstanceRegistration],
]);

const plugin: InfraPlugin = {
  id: '@terrastudio/plugin-aws-compute',
  name: 'AWS Compute',
  version: '0.1.0',
  providerId: 'aws',

  resourceTypes,
  connectionRules: computeConnectionRules,

  paletteCategories: [
    {
      id: 'aws-compute',
      label: 'Compute',
      order: 120,
    },
    {
      id: 'aws-security',
      label: 'Security',
      order: 130,
    },
    {
      id: 'aws-loadbalancing',
      label: 'Load Balancing',
      order: 125,
    },
    {
      id: 'aws-database',
      label: 'Database',
      order: 140,
    },
  ],
};

export default plugin;
