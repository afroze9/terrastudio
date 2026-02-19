import type { ConnectionRule } from '@terrastudio/types';

export const networkingConnectionRules: ConnectionRule[] = [
  {
    sourceType: 'azurerm/networking/virtual_network',
    sourceHandle: 'subnet-out',
    targetType: 'azurerm/networking/subnet',
    targetHandle: 'vnet-in',
    createsReference: {
      side: 'target',
      propertyKey: 'virtual_network_name',
    },
    label: 'Contains subnet',
  },
  {
    sourceType: 'azurerm/networking/network_security_group',
    sourceHandle: 'nsg-out',
    targetType: 'azurerm/networking/subnet',
    targetHandle: 'nsg-in',
    label: 'Associates NSG with subnet',
  },
];
