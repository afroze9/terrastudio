import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';
import { escapeHclString as e } from '@terrastudio/core';

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

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);

    const lines: string[] = [
      `resource "azurerm_storage_account" "${resource.terraformName}" {`,
      `  name                     = "${e(name)}"`,
      `  resource_group_name      = ${rgExpr}`,
      `  location                 = ${locExpr}`,
      `  account_tier             = "${e(accountTier)}"`,
      `  account_replication_type = "${e(replicationType)}"`,
    ];

    if (accountKind && accountKind !== 'StorageV2') {
      lines.push(`  account_kind             = "${e(accountKind)}"`);
    }

    if (accessTier) {
      lines.push(`  access_tier              = "${e(accessTier)}"`);
    }

    if (minTlsVersion && minTlsVersion !== 'TLS1_2') {
      lines.push(`  min_tls_version          = "${e(minTlsVersion)}"`);
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
