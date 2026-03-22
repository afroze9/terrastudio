import type { InfraPlugin, ResourceTypeId, ResourceTypeRegistration } from '@terrastudio/types';
import { aiServicesRegistration } from './resources/ai-services/index.js';
import { aiFoundryRegistration } from './resources/ai-foundry/index.js';
import { aiFoundryProjectRegistration } from './resources/ai-foundry-project/index.js';
import { cognitiveDeploymentRegistration } from './resources/cognitive-deployment/index.js';
import { raiPolicyRegistration } from './resources/rai-policy/index.js';
import { searchServiceRegistration } from './resources/search-service/index.js';
import { cognitiveAccountRegistration } from './resources/cognitive-account/index.js';
import { botServiceRegistration } from './resources/bot-service/index.js';
import { aiConnectionRules } from './connections/rules.js';

const resourceTypes = new Map<ResourceTypeId, ResourceTypeRegistration>([
  ['azurerm/ai/ai_services', aiServicesRegistration],
  ['azurerm/ai/ai_foundry', aiFoundryRegistration],
  ['azurerm/ai/ai_foundry_project', aiFoundryProjectRegistration],
  ['azurerm/ai/cognitive_deployment', cognitiveDeploymentRegistration],
  ['azurerm/ai/rai_policy', raiPolicyRegistration],
  ['azurerm/ai/search_service', searchServiceRegistration],
  ['azurerm/ai/cognitive_account', cognitiveAccountRegistration],
  ['azurerm/ai/bot_service', botServiceRegistration],
]);

const plugin: InfraPlugin = {
  id: '@terrastudio/plugin-azure-ai',
  name: 'Azure AI & ML',
  version: '0.1.0',
  providerId: 'azurerm',

  resourceTypes,
  connectionRules: aiConnectionRules,

  paletteCategories: [
    {
      id: 'ai',
      label: 'AI & ML',
      order: 50,
    },
  ],
};

export default plugin;
