import type { ConnectionRule } from '@terrastudio/types';

export const computeConnectionRules: ConnectionRule[] = [
  {
    sourceType: 'azurerm/containers/container_registry',
    sourceHandle: 'acr-out',
    targetType: 'azurerm/containers/kubernetes_cluster',
    targetHandle: 'acr-link',
    label: 'ACR Integration',
    createsReference: { side: 'target', propertyKey: 'acr_id' },
  },
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
];
