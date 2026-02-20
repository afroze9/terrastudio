import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const blobContainerHclGenerator: HclGenerator = {
  typeId: 'azurerm/storage/blob_container',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const accessType = (props['container_access_type'] as string) ?? 'private';

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
      `resource "azurerm_storage_container" "${resource.terraformName}" {`,
      `  name                  = "${name}"`,
      `  storage_account_name  = ${saNameExpr}`,
      `  container_access_type = "${accessType}"`,
      '}',
    ];

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_storage_container',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
