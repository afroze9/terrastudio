import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';
import { escapeHclString as e } from '@terrastudio/core';

export const tableHclGenerator: HclGenerator = {
  typeId: 'azurerm/storage/table',

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
      `resource "azurerm_storage_table" "${resource.terraformName}" {`,
      `  name                 = "${e(name)}"`,
      `  storage_account_name = ${saNameExpr}`,
      '}',
    ];

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_storage_table',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
