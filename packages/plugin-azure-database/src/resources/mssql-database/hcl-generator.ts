import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const mssqlDatabaseHclGenerator: HclGenerator = {
  typeId: 'azurerm/database/mssql_database',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const skuName = props['sku_name'] as string | undefined;
    const collation = props['collation'] as string | undefined;
    const maxSizeGb = props['max_size_gb'] as number | undefined;
    const zoneRedundant = props['zone_redundant'] as boolean | undefined;
    const licenseType = props['license_type'] as string | undefined;

    const dependsOn: string[] = [];

    // Resolve SQL Server reference (parent containment)
    const serverRef = resource.references['server_id'];
    const serverIdExpr = serverRef
      ? context.getAttributeReference(serverRef, 'id')
      : '"<server-id>"';

    if (serverRef) {
      const serverAddr = context.getTerraformAddress(serverRef);
      if (serverAddr) dependsOn.push(serverAddr);
    }

    const nameExpr = context.getPropertyExpression(resource, 'name', name);

    const lines: string[] = [
      `resource "azurerm_mssql_database" "${resource.terraformName}" {`,
      `  name      = ${nameExpr}`,
      `  server_id = ${serverIdExpr}`,
    ];

    if (skuName) {
      const skuExpr = context.getPropertyExpression(resource, 'sku_name', skuName);
      lines.push(`  sku_name  = ${skuExpr}`);
    }

    if (collation && collation !== 'SQL_Latin1_General_CP1_CI_AS') {
      const collationExpr = context.getPropertyExpression(resource, 'collation', collation);
      lines.push(`  collation = ${collationExpr}`);
    }

    if (maxSizeGb !== undefined && maxSizeGb !== 2) {
      const maxSizeExpr = context.getPropertyExpression(resource, 'max_size_gb', maxSizeGb);
      lines.push(`  max_size_gb = ${maxSizeExpr}`);
    }

    if (zoneRedundant === true) {
      const zoneExpr = context.getPropertyExpression(resource, 'zone_redundant', zoneRedundant);
      lines.push(`  zone_redundant = ${zoneExpr}`);
    }

    if (licenseType) {
      const licenseExpr = context.getPropertyExpression(resource, 'license_type', licenseType);
      lines.push(`  license_type = ${licenseExpr}`);
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_mssql_database',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
