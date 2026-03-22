import type { ConnectionRule } from '@terrastudio/types';

export const computeConnectionRules: ConnectionRule[] = [
  {
    sourceType: 'azurerm/compute/app_service_plan',
    sourceHandle: 'asp-out',
    targetType: 'azurerm/compute/app_service',
    targetHandle: 'asp-in',
    label: 'Service Plan',
    createsReference: { side: 'target', propertyKey: 'service_plan_id' },
  },
  {
    sourceType: 'azurerm/compute/app_service_plan',
    sourceHandle: 'asp-out',
    targetType: 'azurerm/compute/function_app',
    targetHandle: 'asp-in',
    label: 'Service Plan',
    createsReference: { side: 'target', propertyKey: 'service_plan_id' },
  },
  {
    sourceType: 'azurerm/containers/container_registry',
    sourceHandle: 'acr-out',
    targetType: 'azurerm/containers/kubernetes_cluster',
    targetHandle: 'acr-link',
    label: 'ACR Integration',
    createsReference: { side: 'target', propertyKey: 'acr_id' },
  },
  {
    sourceType: 'azurerm/compute/availability_set',
    sourceHandle: 'avset-out',
    targetType: 'azurerm/compute/virtual_machine',
    targetHandle: 'avset-in',
    label: 'Availability Set',
    createsReference: { side: 'target', propertyKey: 'availability_set_id' },
  },
];
