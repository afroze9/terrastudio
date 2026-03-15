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

    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const versionExpr = context.getPropertyExpression(resource, 'version', version);
    const loginExpr = context.getPropertyExpression(resource, 'administrator_login', adminLogin);

    // Use getPropertyExpression to respect variable mode
    // Use default naming pattern (terraformName_propertyKey) to match UI-derived variables
    const passwordExpr = context.getPropertyExpression(
      resource,
      'administrator_login_password',
      adminPassword,
      {
        variableType: 'string',
        variableDescription: `Admin password for SQL Server ${name}`,
        sensitive: true,
      },
    );

    const lines: string[] = [
      `resource "azurerm_mssql_server" "${resource.terraformName}" {`,
      `  name                         = ${nameExpr}`,
      `  resource_group_name          = ${rgExpr}`,
      `  location                     = ${locExpr}`,
      `  version                      = ${versionExpr}`,
      `  administrator_login          = ${loginExpr}`,
      `  administrator_login_password = ${passwordExpr}`,
    ];

    if (minTls && minTls !== '1.2') {
      const minTlsExpr = context.getPropertyExpression(resource, 'minimum_tls_version', minTls);
      lines.push(`  minimum_tls_version          = ${minTlsExpr}`);
    }

    if (publicAccess === false) {
      const publicExpr = context.getPropertyExpression(resource, 'public_network_access_enabled', publicAccess);
      lines.push(`  public_network_access_enabled = ${publicExpr}`);
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
