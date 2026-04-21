import type { ConnectionRule } from '@terrastudio/types';

export const aiConnectionRules: ConnectionRule[] = [
  // AI Services → Cognitive Deployment
  {
    sourceType: 'azurerm/ai/ai_services',
    sourceHandle: 'ai-services-out',
    targetType: 'azurerm/ai/cognitive_deployment',
    targetHandle: 'cognitive-account-in',
    createsReference: { side: 'target', propertyKey: 'cognitive_account_id' },
  },
  // AI Services → RAI Policy
  {
    sourceType: 'azurerm/ai/ai_services',
    sourceHandle: 'ai-services-out',
    targetType: 'azurerm/ai/rai_policy',
    targetHandle: 'cognitive-account-in',
    createsReference: { side: 'target', propertyKey: 'cognitive_account_id' },
  },
  // Cognitive Account → Cognitive Deployment
  {
    sourceType: 'azurerm/ai/cognitive_account',
    sourceHandle: 'cognitive-out',
    targetType: 'azurerm/ai/cognitive_deployment',
    targetHandle: 'cognitive-account-in',
    createsReference: { side: 'target', propertyKey: 'cognitive_account_id' },
  },
  // Cognitive Account → RAI Policy
  {
    sourceType: 'azurerm/ai/cognitive_account',
    sourceHandle: 'cognitive-out',
    targetType: 'azurerm/ai/rai_policy',
    targetHandle: 'cognitive-account-in',
    createsReference: { side: 'target', propertyKey: 'cognitive_account_id' },
  },
  // RAI Policy → Cognitive Deployment
  {
    sourceType: 'azurerm/ai/rai_policy',
    sourceHandle: 'raip-out',
    targetType: 'azurerm/ai/cognitive_deployment',
    targetHandle: 'raip-in',
    createsReference: { side: 'target', propertyKey: 'rai_policy_name' },
  },
  // AI Foundry Hub dependency edges (sourced from the ref-{propKey} handles
  // auto-rendered for showAsEdge reference properties). The reference is set
  // on the source (Hub) side because the Hub's schema owns the property.
  {
    sourceType: 'azurerm/ai/ai_foundry',
    sourceHandle: 'ref-key_vault_id',
    targetType: 'azurerm/security/key_vault',
    targetHandle: 'pep-target',
    label: 'Key Vault',
    createsReference: { side: 'source', propertyKey: 'key_vault_id' },
  },
  {
    sourceType: 'azurerm/ai/ai_foundry',
    sourceHandle: 'ref-storage_account_id',
    targetType: 'azurerm/storage/storage_account',
    targetHandle: 'pep-target',
    label: 'Storage',
    createsReference: { side: 'source', propertyKey: 'storage_account_id' },
  },
  {
    sourceType: 'azurerm/ai/ai_foundry',
    sourceHandle: 'ref-application_insights_id',
    targetType: 'azurerm/monitoring/application_insights',
    targetHandle: 'pep-target',
    label: 'App Insights',
    createsReference: { side: 'source', propertyKey: 'application_insights_id' },
  },
  {
    sourceType: 'azurerm/ai/ai_foundry',
    sourceHandle: 'ref-container_registry_id',
    targetType: 'azurerm/containers/container_registry',
    targetHandle: 'pep-target',
    label: 'Container Registry',
    createsReference: { side: 'source', propertyKey: 'container_registry_id' },
  },
];
