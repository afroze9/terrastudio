import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const mysqlFlexibleServerHclGenerator: HclGenerator = {
  typeId: 'azurerm/database/mysql_flexible_server',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const version = (props['version'] as string) ?? '8.0.21';
    const skuName = (props['sku_name'] as string) ?? 'GP_Standard_D2ds_v4';
    const adminLogin = (props['administrator_login'] as string) ?? 'mysqladmin';
    const adminPassword = (props['administrator_password'] as string) ?? '';
    const storageSizeGb = props['storage_size_gb'] !== undefined ? Number(props['storage_size_gb']) : 20;
    const backupRetention = props['backup_retention_days'] as number | undefined;

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);

    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const versionExpr = context.getPropertyExpression(resource, 'version', version);
    const skuExpr = context.getPropertyExpression(resource, 'sku_name', skuName);
    const loginExpr = context.getPropertyExpression(resource, 'administrator_login', adminLogin);

    const passwordExpr = context.getPropertyExpression(
      resource,
      'administrator_password',
      adminPassword,
      {
        variableType: 'string',
        variableDescription: `Admin password for MySQL server ${name}`,
        sensitive: true,
      },
    );

    const lines: string[] = [
      `resource "azurerm_mysql_flexible_server" "${resource.terraformName}" {`,
      `  name                   = ${nameExpr}`,
      `  location               = ${locExpr}`,
      `  resource_group_name    = ${rgExpr}`,
      `  version                = ${versionExpr}`,
      `  sku_name               = ${skuExpr}`,
      `  administrator_login    = ${loginExpr}`,
      `  administrator_password = ${passwordExpr}`,
    ];

    lines.push('');
    lines.push('  storage {');
    lines.push(`    size_gb = ${context.getPropertyExpression(resource, 'storage_size_gb', storageSizeGb)}`);
    lines.push('  }');

    if (backupRetention !== undefined && backupRetention !== 7) {
      const retentionExpr = context.getPropertyExpression(resource, 'backup_retention_days', backupRetention);
      lines.push(`  backup_retention_days  = ${retentionExpr}`);
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_mysql_flexible_server',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
