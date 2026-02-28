import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';
import { escapeHclString as e } from '@terrastudio/core';

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

    const lines: string[] = [
      `resource "azurerm_mssql_database" "${resource.terraformName}" {`,
      `  name      = "${e(name)}"`,
      `  server_id = ${serverIdExpr}`,
    ];

    if (skuName) {
      lines.push(`  sku_name  = "${e(skuName)}"`);
    }

    if (collation && collation !== 'SQL_Latin1_General_CP1_CI_AS') {
      lines.push(`  collation = "${e(collation)}"`);
    }

    if (maxSizeGb !== undefined && maxSizeGb !== 2) {
      lines.push(`  max_size_gb = ${maxSizeGb}`);
    }

    if (zoneRedundant === true) {
      lines.push('  zone_redundant = true');
    }

    if (licenseType) {
      lines.push(`  license_type = "${e(licenseType)}"`);
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
