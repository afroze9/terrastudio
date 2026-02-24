import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const serviceBusQueueHclGenerator: HclGenerator = {
  typeId: 'azurerm/messaging/servicebus_queue',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const lockDuration = props['lock_duration'] as string | undefined;
    const maxDeliveryCount = props['max_delivery_count'] as number | undefined;
    const requiresDedupe = props['requires_duplicate_detection'] as boolean | undefined;
    const requiresSession = props['requires_session'] as boolean | undefined;
    const deadLetterOnExpiry = props['dead_lettering_on_message_expiration'] as boolean | undefined;

    const dependsOn: string[] = [];

    const namespaceRef = resource.references['namespace_id'];
    const namespaceIdExpr = namespaceRef
      ? context.getAttributeReference(namespaceRef, 'id')
      : '"<namespace-id>"';

    if (namespaceRef) {
      const nsAddr = context.getTerraformAddress(namespaceRef);
      if (nsAddr) dependsOn.push(nsAddr);
    }

    const lines: string[] = [
      `resource "azurerm_servicebus_queue" "${resource.terraformName}" {`,
      `  name         = "${name}"`,
      `  namespace_id = ${namespaceIdExpr}`,
    ];

    if (lockDuration && lockDuration !== 'PT1M') {
      lines.push(`  lock_duration = "${lockDuration}"`);
    }

    if (maxDeliveryCount !== undefined && maxDeliveryCount !== 10) {
      lines.push(`  max_delivery_count = ${maxDeliveryCount}`);
    }

    if (requiresDedupe === true) {
      lines.push('  requires_duplicate_detection = true');
    }

    if (requiresSession === true) {
      lines.push('  requires_session = true');
    }

    if (deadLetterOnExpiry === true) {
      lines.push('  dead_lettering_on_message_expiration = true');
    }

    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_servicebus_queue',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
