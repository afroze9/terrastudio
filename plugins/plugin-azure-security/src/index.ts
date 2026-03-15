import type { InfraPlugin, ResourceTypeId, ResourceTypeRegistration } from '@terrastudio/types';
import { userAssignedIdentityRegistration } from './resources/user-assigned-identity/index.js';
import { roleAssignmentRegistration } from './resources/role-assignment/index.js';
import { securityConnectionRules } from './connections/rules.js';

const resourceTypes = new Map<ResourceTypeId, ResourceTypeRegistration>([
  ['azurerm/identity/user_assigned_identity', userAssignedIdentityRegistration],
  ['azurerm/identity/role_assignment', roleAssignmentRegistration],
]);

const plugin: InfraPlugin = {
  id: '@terrastudio/plugin-azure-security',
  name: 'Azure Identity & Security',
  version: '0.1.0',
  providerId: 'azurerm',

  resourceTypes,
  connectionRules: securityConnectionRules,

  paletteCategories: [
    {
      id: 'identity',
      label: 'Identity',
      order: 42,
    },
  ],
};

export default plugin;
