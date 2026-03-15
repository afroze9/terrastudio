import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const postgresqlFlexibleServerHclGenerator: HclGenerator = {
  typeId: 'azurerm/database/postgresql_flexible_server',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const version = (props['version'] as string) ?? '16';
    const skuName = (props['sku_name'] as string) ?? 'GP_Standard_D2s_v3';
    const adminLogin = (props['administrator_login'] as string) ?? 'psqladmin';
    const adminPassword = (props['administrator_password'] as string) ?? '';
    const storageMb = (props['storage_mb'] as number) ?? 32768;
    const backupRetention = props['backup_retention_days'] as number | undefined;
    const publicAccess = props['public_network_access_enabled'] as boolean | undefined;

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);

    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const versionExpr = context.getPropertyExpression(resource, 'version', version);
    const skuExpr = context.getPropertyExpression(resource, 'sku_name', skuName);
    const storageMbExpr = context.getPropertyExpression(resource, 'storage_mb', storageMb);
    const loginExpr = context.getPropertyExpression(resource, 'administrator_login', adminLogin);

    const passwordExpr = context.getPropertyExpression(
      resource,
      'administrator_password',
      adminPassword,
      {
        variableType: 'string',
        variableDescription: `Admin password for PostgreSQL server ${name}`,
        sensitive: true,
      },
    );

    const lines: string[] = [
      `resource "azurerm_postgresql_flexible_server" "${resource.terraformName}" {`,
      `  name                   = ${nameExpr}`,
      `  location               = ${locExpr}`,
      `  resource_group_name    = ${rgExpr}`,
      `  version                = ${versionExpr}`,
      `  sku_name               = ${skuExpr}`,
      `  storage_mb             = ${storageMbExpr}`,
      `  administrator_login    = ${loginExpr}`,
      `  administrator_password = ${passwordExpr}`,
    ];

    if (backupRetention !== undefined && backupRetention !== 7) {
      const retentionExpr = context.getPropertyExpression(resource, 'backup_retention_days', backupRetention);
      lines.push(`  backup_retention_days  = ${retentionExpr}`);
    }

    if (publicAccess === true) {
      const publicExpr = context.getPropertyExpression(resource, 'public_network_access_enabled', publicAccess);
      lines.push(`  public_network_access_enabled = ${publicExpr}`);
    } else {
      const publicExpr = context.getPropertyExpression(resource, 'public_network_access_enabled', false);
      lines.push(`  public_network_access_enabled = ${publicExpr}`);
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_postgresql_flexible_server',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
