import type { InfraPlugin, ResourceTypeId, ResourceTypeRegistration } from '@terrastudio/types';
import { resourceGroupRegistration } from './resources/resource-group/index.js';
import { vmRegistration } from './resources/virtual-machine/index.js';
import { computeConnectionRules } from './connections/rules.js';

const resourceTypes = new Map<ResourceTypeId, ResourceTypeRegistration>([
  ['azurerm/core/resource_group', resourceGroupRegistration],
  ['azurerm/compute/virtual_machine', vmRegistration],
]);

const plugin: InfraPlugin = {
  id: '@terrastudio/plugin-azure-compute',
  name: 'Azure Compute',
  version: '0.1.0',
  providerId: 'azurerm',

  resourceTypes,
  connectionRules: computeConnectionRules,

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
  ],
};

export default plugin;
