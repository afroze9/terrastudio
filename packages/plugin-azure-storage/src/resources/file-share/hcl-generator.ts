import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';
import { escapeHclString as e } from '@terrastudio/core';

export const fileShareHclGenerator: HclGenerator = {
  typeId: 'azurerm/storage/file_share',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const quota = (props['quota'] as number) ?? 50;
    const accessTier = props['access_tier'] as string | undefined;
    const protocol = props['enabled_protocol'] as string | undefined;

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
      `resource "azurerm_storage_share" "${resource.terraformName}" {`,
      `  name                 = "${e(name)}"`,
      `  storage_account_id   = ${saIdExpr}`,
      `  quota                = ${quota}`,
    ];

    if (accessTier && accessTier !== 'Hot') {
      lines.push(`  access_tier          = "${e(accessTier)}"`);
    }

    if (protocol && protocol !== 'SMB') {
      lines.push(`  enabled_protocol     = "${e(protocol)}"`);
    }

    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_storage_share',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
