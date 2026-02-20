import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const storageAccountHclGenerator: HclGenerator = {
  typeId: 'azurerm/storage/storage_account',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const accountTier = (props['account_tier'] as string) ?? 'Standard';
    const replicationType = (props['account_replication_type'] as string) ?? 'LRS';
    const accountKind = props['account_kind'] as string | undefined;
    const accessTier = props['access_tier'] as string | undefined;
    const minTlsVersion = props['min_tls_version'] as string | undefined;
    const httpsOnly = props['https_traffic_only_enabled'] as boolean | undefined;

    const rgExpr = context.getResourceGroupExpression();
    const locExpr = context.getLocationExpression();

    const lines: string[] = [
      `resource "azurerm_storage_account" "${resource.terraformName}" {`,
      `  name                     = "${name}"`,
      `  resource_group_name      = ${rgExpr}`,
      `  location                 = ${locExpr}`,
      `  account_tier             = "${accountTier}"`,
      `  account_replication_type = "${replicationType}"`,
    ];

    if (accountKind && accountKind !== 'StorageV2') {
      lines.push(`  account_kind             = "${accountKind}"`);
    }

    if (accessTier) {
      lines.push(`  access_tier              = "${accessTier}"`);
    }

    if (minTlsVersion && minTlsVersion !== 'TLS1_2') {
      lines.push(`  min_tls_version          = "${minTlsVersion}"`);
    }

    if (httpsOnly === false) {
      lines.push('  https_traffic_only_enabled = false');
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_storage_account',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
