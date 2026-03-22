import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const eventhubHclGenerator: HclGenerator = {
  typeId: 'azurerm/messaging/eventhub',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const partitionCount = props['partition_count'] !== undefined ? Number(props['partition_count']) : 2;
    const messageRetention = props['message_retention'] !== undefined ? Number(props['message_retention']) : 1;
    const status = (props['status'] as string) ?? 'Active';

    const dependsOn: string[] = [];

    const namespaceRef = resource.references['namespace_name'];
    const namespaceNameExpr = namespaceRef
      ? context.getAttributeReference(namespaceRef, 'name')
      : '"<namespace-name>"';

    if (namespaceRef) {
      const nsAddr = context.getTerraformAddress(namespaceRef);
      if (nsAddr) dependsOn.push(nsAddr);
    }

    const rgExpr = context.getResourceGroupExpression(resource);
    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const partitionExpr = context.getPropertyExpression(resource, 'partition_count', partitionCount);
    const retentionExpr = context.getPropertyExpression(resource, 'message_retention', messageRetention);

    const lines: string[] = [
      `resource "azurerm_eventhub" "${resource.terraformName}" {`,
      `  name                = ${nameExpr}`,
      `  namespace_name      = ${namespaceNameExpr}`,
      `  resource_group_name = ${rgExpr}`,
      `  partition_count     = ${partitionExpr}`,
      `  message_retention   = ${retentionExpr}`,
    ];

    if (status !== 'Active' || resource.variableOverrides?.['status'] === 'variable') {
      lines.push(`  status              = ${context.getPropertyExpression(resource, 'status', status)}`);
    }

    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_eventhub',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
