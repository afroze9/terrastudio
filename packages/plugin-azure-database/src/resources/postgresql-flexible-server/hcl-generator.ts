import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';
import { escapeHclString as e } from '@terrastudio/core';

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
      `  name                   = "${e(name)}"`,
      `  location               = ${locExpr}`,
      `  resource_group_name    = ${rgExpr}`,
      `  version                = "${e(version)}"`,
      `  sku_name               = "${e(skuName)}"`,
      `  storage_mb             = ${storageMb}`,
      `  administrator_login    = "${e(adminLogin)}"`,
      `  administrator_password = ${passwordExpr}`,
    ];

    if (backupRetention !== undefined && backupRetention !== 7) {
      lines.push(`  backup_retention_days  = ${backupRetention}`);
    }

    if (publicAccess === true) {
      lines.push('  public_network_access_enabled = true');
    } else {
      lines.push('  public_network_access_enabled = false');
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
