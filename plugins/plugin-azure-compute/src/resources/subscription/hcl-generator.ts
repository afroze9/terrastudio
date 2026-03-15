import type {
  HclGenerator,
  HclBlock,
  ResourceInstance,
  HclGenerationContext,
} from '@terrastudio/types';

/**
 * Subscription is a virtual container — it produces no Terraform resource blocks.
 * The pipeline reads its subscription_id property and injects it into the
 * azurerm provider configuration.
 */
export const subscriptionHclGenerator: HclGenerator = {
  typeId: 'azurerm/core/subscription',

  generate(_resource: ResourceInstance, _context: HclGenerationContext): HclBlock[] {
    return [];
  },
};
