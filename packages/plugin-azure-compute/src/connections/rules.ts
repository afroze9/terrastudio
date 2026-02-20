import type { ConnectionRule } from '@terrastudio/types';

export const computeConnectionRules: ConnectionRule[] = [
  {
    sourceType: 'azurerm/networking/network_security_group',
    sourceHandle: 'nsg-out',
    targetType: 'azurerm/compute/virtual_machine',
    targetHandle: 'nsg-in',
    label: 'Associates NSG with VM',
  },
  {
    sourceType: 'azurerm/compute/app_service_plan',
    sourceHandle: 'apps-out',
    targetType: 'azurerm/compute/app_service',
    targetHandle: 'plan-in',
    createsReference: {
      side: 'target',
      propertyKey: 'service_plan_id',
    },
    label: 'Hosts app',
  },
];
