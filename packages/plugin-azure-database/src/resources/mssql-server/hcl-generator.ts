import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const mssqlServerHclGenerator: HclGenerator = {
  typeId: 'azurerm/database/mssql_server',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const version = (props['version'] as string) ?? '12.0';
    const adminLogin = (props['administrator_login'] as string) ?? 'sqladmin';
    const adminPassword = (props['administrator_login_password'] as string) ?? '';
    const minTls = props['minimum_tls_version'] as string | undefined;
    const publicAccess = props['public_network_access_enabled'] as boolean | undefined;

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);

    // Use getPropertyExpression to respect variable mode
    const passwordExpr = context.getPropertyExpression(
      resource,
      'administrator_login_password',
      adminPassword,
      {
        variableName: `${resource.terraformName}_sql_admin_password`,
        variableType: 'string',
        variableDescription: `Admin password for SQL Server ${name}`,
        sensitive: true,
      },
    );

    const lines: string[] = [
      `resource "azurerm_mssql_server" "${resource.terraformName}" {`,
      `  name                         = "${name}"`,
      `  resource_group_name          = ${rgExpr}`,
      `  location                     = ${locExpr}`,
      `  version                      = "${version}"`,
      `  administrator_login          = "${adminLogin}"`,
      `  administrator_login_password = ${passwordExpr}`,
    ];

    if (minTls && minTls !== '1.2') {
      lines.push(`  minimum_tls_version          = "${minTls}"`);
    }

    if (publicAccess === false) {
      lines.push('  public_network_access_enabled = false');
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_mssql_server',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
