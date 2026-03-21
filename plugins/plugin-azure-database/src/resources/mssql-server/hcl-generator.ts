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
    const connectionPolicy = (props['connection_policy'] as string) ?? 'Default';
    const outboundRestriction = props['outbound_network_restriction_enabled'] as boolean | undefined;
    const identityEnabled = props['identity_enabled'] as boolean | undefined;
    const identityType = (props['identity_type'] as string) ?? 'SystemAssigned';
    const azureadAuthOnly = props['azuread_auth_only'] as boolean | undefined;
    const azureadAdminLogin = props['azuread_admin_login'] as string | undefined;
    const azureadAdminObjectId = props['azuread_admin_object_id'] as string | undefined;

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

    if (publicAccess === false || resource.variableOverrides?.['public_network_access_enabled'] === 'variable') {
      const publicExpr = context.getPropertyExpression(resource, 'public_network_access_enabled', publicAccess ?? true);
      lines.push(`  public_network_access_enabled = ${publicExpr}`);
    }

    if (connectionPolicy !== 'Default' || resource.variableOverrides?.['connection_policy'] === 'variable') {
      const connPolicyExpr = context.getPropertyExpression(resource, 'connection_policy', connectionPolicy);
      lines.push(`  connection_policy              = ${connPolicyExpr}`);
    }

    if (outboundRestriction === true || resource.variableOverrides?.['outbound_network_restriction_enabled'] === 'variable') {
      const outboundExpr = context.getPropertyExpression(resource, 'outbound_network_restriction_enabled', outboundRestriction ?? false);
      lines.push(`  outbound_network_restriction_enabled = ${outboundExpr}`);
    }

    // Identity block
    if (identityEnabled) {
      const identityExpr = context.getPropertyExpression(resource, 'identity_type', identityType);
      lines.push('');
      lines.push('  identity {');
      lines.push(`    type = ${identityExpr}`);
      lines.push('  }');
    } else if (resource.variableOverrides?.['identity_type'] === 'variable') {
      const identityExpr = context.getPropertyExpression(resource, 'identity_type', identityType);
      lines.push('');
      lines.push('  identity {');
      lines.push(`    type = ${identityExpr}`);
      lines.push('  }');
    }

    // Azure AD Administrator block
    if ((azureadAdminLogin && azureadAdminObjectId) || resource.variableOverrides?.['azuread_admin_login'] === 'variable' || resource.variableOverrides?.['azuread_admin_object_id'] === 'variable') {
      const aadLoginExpr = context.getPropertyExpression(resource, 'azuread_admin_login', azureadAdminLogin ?? '');
      const aadObjectIdExpr = context.getPropertyExpression(resource, 'azuread_admin_object_id', azureadAdminObjectId ?? '');
      lines.push('');
      lines.push('  azuread_administrator {');
      lines.push(`    login_username = ${aadLoginExpr}`);
      lines.push(`    object_id      = ${aadObjectIdExpr}`);
      if (azureadAuthOnly || resource.variableOverrides?.['azuread_auth_only'] === 'variable') {
        const authOnlyExpr = context.getPropertyExpression(resource, 'azuread_auth_only', azureadAuthOnly ?? false);
        lines.push(`    azuread_authentication_only = ${authOnlyExpr}`);
      }
      lines.push('  }');
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
