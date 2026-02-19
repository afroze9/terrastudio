import type { ConnectionRule } from '@terrastudio/types';

export const computeConnectionRules: ConnectionRule[] = [
  {
    sourceType: 'azurerm/networking/subnet',
    sourceHandle: 'resource-out',
    targetType: 'azurerm/compute/virtual_machine',
    targetHandle: 'subnet-in',
    createsReference: {
      side: 'target',
      propertyKey: 'subnet_id',
    },
    label: 'VM connects to subnet',
  },
  {
    sourceType: 'azurerm/networking/network_security_group',
    sourceHandle: 'nsg-out',
    targetType: 'azurerm/compute/virtual_machine',
    targetHandle: 'nsg-in',
    label: 'Associates NSG with VM',
  },
];
