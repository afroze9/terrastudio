import type { ConnectionRule } from '@terrastudio/types';

export const networkingConnectionRules: ConnectionRule[] = [
  {
    sourceType: 'azurerm/networking/subnet',
    sourceHandle: 'subnet-out',
    targetType: 'azurerm/containers/kubernetes_cluster',
    targetHandle: 'subnet-in',
    label: 'Subnet',
    createsReference: { side: 'target', propertyKey: 'vnet_subnet_id' },
  },
  {
    sourceType: 'azurerm/networking/subnet',
    sourceHandle: 'subnet-out',
    targetType: 'azurerm/containers/kubernetes_cluster_node_pool',
    targetHandle: 'subnet-in',
    label: 'Subnet',
    createsReference: { side: 'target', propertyKey: 'vnet_subnet_id' },
  },
  {
    sourceType: 'azurerm/networking/load_balancer',
    sourceHandle: 'lb-backend-out',
    targetType: 'azurerm/compute/virtual_machine_scale_set',
    targetHandle: 'lb-backend-in',
    label: 'Backend Pool',
    createsReference: { side: 'target', propertyKey: 'lb_backend_pool_id' },
  },
];
