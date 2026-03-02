import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const serviceBusTopicHclGenerator: HclGenerator = {
  typeId: 'azurerm/messaging/servicebus_topic',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const maxSizeMb = props['max_size_in_megabytes'] !== undefined ? Number(props['max_size_in_megabytes']) : undefined;
    const requiresDedupe = props['requires_duplicate_detection'] as boolean | undefined;
    const supportOrdering = props['support_ordering'] as boolean | undefined;

    const dependsOn: string[] = [];

    const namespaceRef = resource.references['namespace_id'];
    const namespaceIdExpr = namespaceRef
      ? context.getAttributeReference(namespaceRef, 'id')
      : '"<namespace-id>"';

    if (namespaceRef) {
      const nsAddr = context.getTerraformAddress(namespaceRef);
      if (nsAddr) dependsOn.push(nsAddr);
    }

    const nameExpr = context.getPropertyExpression(resource, 'name', name);

    const lines: string[] = [
      `resource "azurerm_servicebus_topic" "${resource.terraformName}" {`,
      `  name         = ${nameExpr}`,
      `  namespace_id = ${namespaceIdExpr}`,
    ];

    if (maxSizeMb !== undefined && maxSizeMb !== 1024) {
      lines.push(`  max_size_in_megabytes = ${context.getPropertyExpression(resource, 'max_size_in_megabytes', maxSizeMb)}`);
    }

    if (requiresDedupe === true) {
      lines.push(`  requires_duplicate_detection = ${context.getPropertyExpression(resource, 'requires_duplicate_detection', requiresDedupe)}`);
    }

    if (supportOrdering === true) {
      lines.push(`  support_ordering = ${context.getPropertyExpression(resource, 'support_ordering', supportOrdering)}`);
    }

    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_servicebus_topic',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
