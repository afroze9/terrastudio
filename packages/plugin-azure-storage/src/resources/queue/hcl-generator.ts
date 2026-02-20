import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const queueHclGenerator: HclGenerator = {
  typeId: 'azurerm/storage/queue',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;

    const saRef = resource.references['storage_account_name'];
    const saNameExpr = saRef
      ? context.getAttributeReference(saRef, 'name')
      : '"<storage-account-name>"';

    const dependsOn: string[] = [];
    if (saRef) {
      const saAddr = context.getTerraformAddress(saRef);
      if (saAddr) dependsOn.push(saAddr);
    }

    const lines: string[] = [
      `resource "azurerm_storage_queue" "${resource.terraformName}" {`,
      `  name                 = "${name}"`,
      `  storage_account_name = ${saNameExpr}`,
      '}',
    ];

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_storage_queue',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
