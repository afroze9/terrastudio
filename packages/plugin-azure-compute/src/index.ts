import type { InfraPlugin, ResourceTypeId, ResourceTypeRegistration } from '@terrastudio/types';
import { subscriptionRegistration } from './resources/subscription/index.js';
import { resourceGroupRegistration } from './resources/resource-group/index.js';
import { vmRegistration } from './resources/virtual-machine/index.js';
import { keyVaultRegistration } from './resources/key-vault/index.js';
import { appServicePlanRegistration } from './resources/app-service-plan/index.js';
import { appServiceRegistration } from './resources/app-service/index.js';
import { functionAppRegistration } from './resources/function-app/index.js';
import { containerRegistryRegistration } from './resources/container-registry/index.js';
import { kubernetesClusterRegistration } from './resources/kubernetes-cluster/index.js';
import { kubernetesClusterNodePoolRegistration } from './resources/kubernetes-cluster-node-pool/index.js';
import { serviceBusNamespaceRegistration } from './resources/servicebus-namespace/index.js';
import { serviceBusQueueRegistration } from './resources/servicebus-queue/index.js';
import { serviceBusTopicRegistration } from './resources/servicebus-topic/index.js';
import { eventhubNamespaceRegistration } from './resources/eventhub-namespace/index.js';
import { eventhubRegistration } from './resources/eventhub/index.js';
import { keyVaultSecretRegistration } from './resources/key-vault-secret/index.js';
import { keyVaultKeyRegistration } from './resources/key-vault-key/index.js';
import { cdnProfileRegistration } from './resources/cdn-profile/index.js';
import { cdnEndpointRegistration } from './resources/cdn-endpoint/index.js';
import { frontdoorProfileRegistration } from './resources/frontdoor-profile/index.js';
import { containerAppEnvironmentRegistration } from './resources/container-app-environment/index.js';
import { containerAppRegistration } from './resources/container-app/index.js';
import { containerGroupRegistration } from './resources/container-group/index.js';
import { availabilitySetRegistration } from './resources/availability-set/index.js';
import { vmScaleSetRegistration } from './resources/vm-scale-set/index.js';
import { staticWebAppRegistration } from './resources/static-web-app/index.js';
import { signalrServiceRegistration } from './resources/signalr-service/index.js';
import { computeConnectionRules } from './connections/rules.js';
import { keyVaultSecretBinding } from './bindings/keyvault-secret.js';

const resourceTypes = new Map<ResourceTypeId, ResourceTypeRegistration>([
  ['azurerm/core/subscription', subscriptionRegistration],
  ['azurerm/core/resource_group', resourceGroupRegistration],
  ['azurerm/compute/virtual_machine', vmRegistration],
  ['azurerm/security/key_vault', keyVaultRegistration],
  ['azurerm/compute/app_service_plan', appServicePlanRegistration],
  ['azurerm/compute/app_service', appServiceRegistration],
  ['azurerm/compute/function_app', functionAppRegistration],
  ['azurerm/containers/container_registry', containerRegistryRegistration],
  ['azurerm/containers/kubernetes_cluster', kubernetesClusterRegistration],
  ['azurerm/containers/kubernetes_cluster_node_pool', kubernetesClusterNodePoolRegistration],
  ['azurerm/messaging/servicebus_namespace', serviceBusNamespaceRegistration],
  ['azurerm/messaging/servicebus_queue', serviceBusQueueRegistration],
  ['azurerm/messaging/servicebus_topic', serviceBusTopicRegistration],
  ['azurerm/messaging/eventhub_namespace', eventhubNamespaceRegistration],
  ['azurerm/messaging/eventhub', eventhubRegistration],
  ['azurerm/security/key_vault_secret', keyVaultSecretRegistration],
  ['azurerm/security/key_vault_key', keyVaultKeyRegistration],
  ['azurerm/web/cdn_profile', cdnProfileRegistration],
  ['azurerm/web/cdn_endpoint', cdnEndpointRegistration],
  ['azurerm/web/frontdoor_profile', frontdoorProfileRegistration],
  ['azurerm/containers/container_app_environment', containerAppEnvironmentRegistration],
  ['azurerm/containers/container_app', containerAppRegistration],
  ['azurerm/containers/container_group', containerGroupRegistration],
  ['azurerm/compute/availability_set', availabilitySetRegistration],
  ['azurerm/compute/virtual_machine_scale_set', vmScaleSetRegistration],
  ['azurerm/web/static_web_app', staticWebAppRegistration],
  ['azurerm/web/signalr_service', signalrServiceRegistration],
]);

const plugin: InfraPlugin = {
  id: '@terrastudio/plugin-azure-compute',
  name: 'Azure Compute',
  version: '0.1.0',
  providerId: 'azurerm',

  resourceTypes,
  connectionRules: computeConnectionRules,
  bindingGenerators: [keyVaultSecretBinding],

  paletteCategories: [
    {
      id: 'core',
      label: 'Core',
      order: 1,
    },
    {
      id: 'compute',
      label: 'Compute',
      order: 20,
    },
    {
      id: 'containers',
      label: 'Containers',
      order: 35,
    },
    {
      id: 'messaging',
      label: 'Messaging',
      order: 38,
    },
    {
      id: 'security',
      label: 'Security',
      order: 40,
    },
    {
      id: 'web',
      label: 'Web',
      order: 45,
    },
  ],
};

export default plugin;
