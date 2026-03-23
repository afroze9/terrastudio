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
];
