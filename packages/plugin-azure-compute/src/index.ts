import type { InfraPlugin, ResourceTypeId, ResourceTypeRegistration } from '@terrastudio/types';
import { subscriptionRegistration } from './resources/subscription/index.js';
import { resourceGroupRegistration } from './resources/resource-group/index.js';
import { vmRegistration } from './resources/virtual-machine/index.js';
import { keyVaultRegistration } from './resources/key-vault/index.js';
import { appServicePlanRegistration } from './resources/app-service-plan/index.js';
import { appServiceRegistration } from './resources/app-service/index.js';
import { functionAppRegistration } from './resources/function-app/index.js';
import { containerRegistryRegistration } from './resources/container-registry/index.js';
import { serviceBusNamespaceRegistration } from './resources/servicebus-namespace/index.js';
import { serviceBusQueueRegistration } from './resources/servicebus-queue/index.js';
import { serviceBusTopicRegistration } from './resources/servicebus-topic/index.js';
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
  ['azurerm/messaging/servicebus_namespace', serviceBusNamespaceRegistration],
  ['azurerm/messaging/servicebus_queue', serviceBusQueueRegistration],
  ['azurerm/messaging/servicebus_topic', serviceBusTopicRegistration],
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
  ],
};

export default plugin;
