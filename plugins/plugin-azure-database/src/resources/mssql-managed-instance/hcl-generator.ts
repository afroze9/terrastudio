import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const mssqlManagedInstanceHclGenerator: HclGenerator = {
  typeId: 'azurerm/database/mssql_managed_instance',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const skuName = (props['sku_name'] as string) ?? 'GP_Gen5';
    const vcoresRaw = props['vcores'];
    const vcores = typeof vcoresRaw === 'number' ? vcoresRaw : parseInt(String(vcoresRaw ?? 4), 10);
    const storage = (props['storage_size_in_gb'] as number) ?? 32;
    const licenseType = (props['license_type'] as string) ?? 'LicenseIncluded';
    const adminLogin = (props['administrator_login'] as string) ?? 'sqladmin';
    const adminPassword = (props['administrator_login_password'] as string) ?? '';
    const minTls = props['minimum_tls_version'] as string | undefined;
    const publicDataEndpoint = props['public_data_endpoint_enabled'] as boolean | undefined;
    const proxyOverride = props['proxy_override'] as string | undefined;
    const timezoneId = props['timezone_id'] as string | undefined;
    const collation = props['collation'] as string | undefined;
    const identityEnabled = props['identity_enabled'] as boolean | undefined;
    const identityType = (props['identity_type'] as string) ?? 'SystemAssigned';

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);
    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const skuExpr = context.getPropertyExpression(resource, 'sku_name', skuName);
    const vcoresExpr = context.getPropertyExpression(resource, 'vcores', vcores);
    const storageExpr = context.getPropertyExpression(resource, 'storage_size_in_gb', storage);
    const licenseExpr = context.getPropertyExpression(resource, 'license_type', licenseType);
    const loginExpr = context.getPropertyExpression(resource, 'administrator_login', adminLogin);
    const passwordExpr = context.getPropertyExpression(
      resource,
      'administrator_login_password',
      adminPassword,
      {
        variableType: 'string',
        variableDescription: `Admin password for SQL Managed Instance ${name}`,
        sensitive: true,
      },
    );

    const dependsOn: string[] = [];
    const subnetRef = resource.references['subnet_id'];
    const subnetIdExpr = subnetRef
      ? context.getAttributeReference(subnetRef, 'id')
      : '"<subnet-id>"';
    if (subnetRef) {
      const addr = context.getTerraformAddress(subnetRef);
      if (addr) dependsOn.push(addr);
    }

    const lines: string[] = [
      `resource "azurerm_mssql_managed_instance" "${resource.terraformName}" {`,
      `  name                         = ${nameExpr}`,
      `  resource_group_name          = ${rgExpr}`,
      `  location                     = ${locExpr}`,
      `  subnet_id                    = ${subnetIdExpr}`,
      `  sku_name                     = ${skuExpr}`,
      `  vcores                       = ${vcoresExpr}`,
      `  storage_size_in_gb           = ${storageExpr}`,
      `  license_type                 = ${licenseExpr}`,
      `  administrator_login          = ${loginExpr}`,
      `  administrator_login_password = ${passwordExpr}`,
    ];

    if (minTls && minTls !== '1.2') {
      lines.push(`  minimum_tls_version          = ${context.getPropertyExpression(resource, 'minimum_tls_version', minTls)}`);
    }

    if (publicDataEndpoint === true || resource.variableOverrides?.['public_data_endpoint_enabled'] === 'variable') {
      lines.push(`  public_data_endpoint_enabled = ${context.getPropertyExpression(resource, 'public_data_endpoint_enabled', publicDataEndpoint ?? false)}`);
    }

    if (proxyOverride && proxyOverride !== 'Default') {
      lines.push(`  proxy_override               = ${context.getPropertyExpression(resource, 'proxy_override', proxyOverride)}`);
    }

    if (timezoneId && timezoneId !== 'UTC') {
      lines.push(`  timezone_id                  = ${context.getPropertyExpression(resource, 'timezone_id', timezoneId)}`);
    }

    if (collation && collation !== 'SQL_Latin1_General_CP1_CI_AS') {
      lines.push(`  collation                    = ${context.getPropertyExpression(resource, 'collation', collation)}`);
    }

    if (identityEnabled) {
      const identityExpr = context.getPropertyExpression(resource, 'identity_type', identityType);
      lines.push('');
      lines.push('  identity {');
      lines.push(`    type = ${identityExpr}`);
      lines.push('  }');
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_mssql_managed_instance',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
