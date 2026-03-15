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

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);

    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const tierExpr = context.getPropertyExpression(resource, 'account_tier', accountTier);
    const replExpr = context.getPropertyExpression(resource, 'account_replication_type', replicationType);

    const lines: string[] = [
      `resource "azurerm_storage_account" "${resource.terraformName}" {`,
      `  name                     = ${nameExpr}`,
      `  resource_group_name      = ${rgExpr}`,
      `  location                 = ${locExpr}`,
      `  account_tier             = ${tierExpr}`,
      `  account_replication_type = ${replExpr}`,
    ];

    if (accountKind && accountKind !== 'StorageV2') {
      const kindExpr = context.getPropertyExpression(resource, 'account_kind', accountKind);
      lines.push(`  account_kind             = ${kindExpr}`);
    }

    if (accessTier) {
      const accessTierExpr = context.getPropertyExpression(resource, 'access_tier', accessTier);
      lines.push(`  access_tier              = ${accessTierExpr}`);
    }

    if (minTlsVersion && minTlsVersion !== 'TLS1_2') {
      const tlsExpr = context.getPropertyExpression(resource, 'min_tls_version', minTlsVersion);
      lines.push(`  min_tls_version          = ${tlsExpr}`);
    }

    if (httpsOnly === false) {
      const httpsExpr = context.getPropertyExpression(resource, 'https_traffic_only_enabled', httpsOnly);
      lines.push(`  https_traffic_only_enabled = ${httpsExpr}`);
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
