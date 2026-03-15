import type { ConnectionRule } from '@terrastudio/types';

export const awsNetworkingConnectionRules: ConnectionRule[] = [
  {
    sourceType: 'aws/networking/subnet',
    sourceHandle: 'subnet-out',
    targetType: 'aws/networking/route_table',
    targetHandle: 'subnet-in',
    label: 'Subnet',
    createsReference: { side: 'target', propertyKey: 'subnet_id' },
  },
];
