import type { ConnectionRule } from '@terrastudio/types';

export const networkingConnectionRules: ConnectionRule[] = [
  {
    sourceType: 'azurerm/networking/network_security_group',
    sourceHandle: 'nsg-out',
    targetType: 'azurerm/networking/subnet',
    targetHandle: 'nsg-in',
    label: 'Associates NSG with subnet',
  },
];
