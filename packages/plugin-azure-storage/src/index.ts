import type { InfraPlugin, ResourceTypeId, ResourceTypeRegistration } from '@terrastudio/types';
import { storageAccountRegistration } from './resources/storage-account/index.js';
import { storageConnectionRules } from './connections/rules.js';

const resourceTypes = new Map<ResourceTypeId, ResourceTypeRegistration>([
  ['azurerm/storage/storage_account', storageAccountRegistration],
]);

const plugin: InfraPlugin = {
  id: '@terrastudio/plugin-azure-storage',
  name: 'Azure Storage',
  version: '0.1.0',
  providerId: 'azurerm',

  resourceTypes,
  connectionRules: storageConnectionRules,

  paletteCategories: [
    {
      id: 'storage',
      label: 'Storage',
      order: 30,
    },
  ],
};

export default plugin;
