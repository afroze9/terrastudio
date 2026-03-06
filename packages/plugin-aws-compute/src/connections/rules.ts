import type { ConnectionRule } from '@terrastudio/types';

export const computeConnectionRules: ConnectionRule[] = [
  {
    sourceType: 'aws/networking/subnet',
    sourceHandle: 'subnet-out',
    targetType: 'aws/compute/alb',
    targetHandle: 'subnet-target',
    label: 'Subnet',
    createsReference: { side: 'target', propertyKey: 'subnet_ids' },
  },
  {
    sourceType: 'aws/compute/instance',
    sourceHandle: 'ec2-out',
    targetType: 'aws/compute/eip',
    targetHandle: 'ec2-in',
    label: 'EC2 Instance',
    createsReference: { side: 'target', propertyKey: 'instance_id' },
  },
];
