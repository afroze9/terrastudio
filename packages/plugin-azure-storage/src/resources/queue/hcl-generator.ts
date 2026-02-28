import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';
import { escapeHclString as e } from '@terrastudio/core';

export const queueHclGenerator: HclGenerator = {
  typeId: 'azurerm/storage/queue',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;

    const saRef = resource.references['storage_account_id'];
    const saIdExpr = saRef
      ? context.getAttributeReference(saRef, 'id')
      : '"<storage-account-id>"';

    const dependsOn: string[] = [];
    if (saRef) {
      const saAddr = context.getTerraformAddress(saRef);
      if (saAddr) dependsOn.push(saAddr);
    }

    const lines: string[] = [
      `resource "azurerm_storage_queue" "${resource.terraformName}" {`,
      `  name                 = "${e(name)}"`,
      `  storage_account_id   = ${saIdExpr}`,
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
