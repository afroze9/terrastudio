import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const tableHclGenerator: HclGenerator = {
  typeId: 'azurerm/storage/table',

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

    const nameExpr = context.getPropertyExpression(resource, 'name', name);

    const lines: string[] = [
      `resource "azurerm_storage_table" "${resource.terraformName}" {`,
      `  name                 = ${nameExpr}`,
      `  storage_account_id   = ${saIdExpr}`,
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
