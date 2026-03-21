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
    const sharedAccessKeyEnabled = props['shared_access_key_enabled'] as boolean | undefined;
    const publicNetworkAccessEnabled = props['public_network_access_enabled'] as boolean | undefined;
    const infrastructureEncryptionEnabled = props['infrastructure_encryption_enabled'] as boolean | undefined;
    const identityEnabled = props['identity_enabled'] as boolean | undefined;
    const identityType = (props['identity_type'] as string) ?? 'SystemAssigned';
    const versioningEnabled = props['versioning_enabled'] as boolean | undefined;
    const deleteRetentionDays = props['delete_retention_days'] as number | undefined;
    const containerDeleteRetentionDays = props['container_delete_retention_days'] as number | undefined;
    const networkDefaultAction = props['network_default_action'] as string | undefined;
    const networkBypass = props['network_bypass'] as string[] | undefined;

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

    if (httpsOnly === false || resource.variableOverrides?.['https_traffic_only_enabled'] === 'variable') {
      const httpsExpr = context.getPropertyExpression(resource, 'https_traffic_only_enabled', httpsOnly ?? true);
      lines.push(`  https_traffic_only_enabled = ${httpsExpr}`);
    }

    if (sharedAccessKeyEnabled === false || resource.variableOverrides?.['shared_access_key_enabled'] === 'variable') {
      const expr = context.getPropertyExpression(resource, 'shared_access_key_enabled', sharedAccessKeyEnabled ?? true);
      lines.push(`  shared_access_key_enabled  = ${expr}`);
    }

    if (publicNetworkAccessEnabled === false || resource.variableOverrides?.['public_network_access_enabled'] === 'variable') {
      const expr = context.getPropertyExpression(resource, 'public_network_access_enabled', publicNetworkAccessEnabled ?? true);
      lines.push(`  public_network_access_enabled = ${expr}`);
    }

    if (infrastructureEncryptionEnabled === true || resource.variableOverrides?.['infrastructure_encryption_enabled'] === 'variable') {
      const expr = context.getPropertyExpression(resource, 'infrastructure_encryption_enabled', infrastructureEncryptionEnabled ?? false);
      lines.push(`  infrastructure_encryption_enabled = ${expr}`);
    }

    // Identity block
    if (identityEnabled || resource.variableOverrides?.['identity_type'] === 'variable') {
      lines.push('');
      lines.push('  identity {');
      lines.push(`    type = ${context.getPropertyExpression(resource, 'identity_type', identityType)}`);
      lines.push('  }');
    }

    // Blob properties block
    const hasVersioning = versioningEnabled === true || resource.variableOverrides?.['versioning_enabled'] === 'variable';
    const hasDeleteRetention = (deleteRetentionDays !== undefined && deleteRetentionDays !== 7) || resource.variableOverrides?.['delete_retention_days'] === 'variable';
    const hasContainerDeleteRetention = (containerDeleteRetentionDays !== undefined && containerDeleteRetentionDays !== 7) || resource.variableOverrides?.['container_delete_retention_days'] === 'variable';

    if (hasVersioning || hasDeleteRetention || hasContainerDeleteRetention) {
      lines.push('');
      lines.push('  blob_properties {');

      if (hasVersioning) {
        lines.push(`    versioning_enabled = ${context.getPropertyExpression(resource, 'versioning_enabled', versioningEnabled ?? false)}`);
      }

      if (hasDeleteRetention) {
        lines.push('');
        lines.push('    delete_retention_policy {');
        lines.push(`      days = ${context.getPropertyExpression(resource, 'delete_retention_days', deleteRetentionDays ?? 7)}`);
        lines.push('    }');
      }

      if (hasContainerDeleteRetention) {
        lines.push('');
        lines.push('    container_delete_retention_policy {');
        lines.push(`      days = ${context.getPropertyExpression(resource, 'container_delete_retention_days', containerDeleteRetentionDays ?? 7)}`);
        lines.push('    }');
      }

      lines.push('  }');
    }

    // Network rules block
    const networkIsDeny = networkDefaultAction === 'Deny' || resource.variableOverrides?.['network_default_action'] === 'variable';

    if (networkIsDeny) {
      lines.push('');
      lines.push('  network_rules {');
      lines.push(`    default_action = ${context.getPropertyExpression(resource, 'network_default_action', networkDefaultAction ?? 'Allow')}`);

      if ((networkBypass && networkBypass.length > 0) || resource.variableOverrides?.['network_bypass'] === 'variable') {
        const bypassExpr = context.getPropertyExpression(resource, 'network_bypass', networkBypass ?? ['AzureServices']);
        lines.push(`    bypass         = ${bypassExpr}`);
      }

      lines.push('  }');
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
