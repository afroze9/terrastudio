import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';
import { escapeHclString as e } from '@terrastudio/core';

export const cosmosdbAccountHclGenerator: HclGenerator = {
  typeId: 'azurerm/database/cosmosdb_account',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const kind = (props['kind'] as string) ?? 'GlobalDocumentDB';
    const consistencyLevel = (props['consistency_level'] as string) ?? 'Session';
    const geoRedundant = props['geo_redundant_backup_enabled'] as boolean | undefined;
    const multiWrite = props['multiple_write_locations_enabled'] as boolean | undefined;
    const autoFailover = props['automatic_failover_enabled'] as boolean | undefined;
    const publicAccess = props['public_network_access_enabled'] as boolean | undefined;

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);

    const lines: string[] = [
      `resource "azurerm_cosmosdb_account" "${resource.terraformName}" {`,
      `  name                = "${e(name)}"`,
      `  location            = ${locExpr}`,
      `  resource_group_name = ${rgExpr}`,
      `  offer_type          = "Standard"`,
      `  kind                = "${e(kind)}"`,
    ];

    if (autoFailover !== false) {
      lines.push('  automatic_failover_enabled = true');
    }

    if (multiWrite === true) {
      lines.push('  multiple_write_locations_enabled = true');
    }

    if (geoRedundant === true) {
      lines.push('  geo_redundant_backup_enabled = true');
    }

    if (publicAccess === false) {
      lines.push('  public_network_access_enabled = false');
    }

    lines.push('');
    lines.push('  consistency_policy {');
    lines.push(`    consistency_level = "${e(consistencyLevel)}"`);
    lines.push('  }');
    lines.push('');
    lines.push('  geo_location {');
    lines.push(`    location          = ${locExpr}`);
    lines.push('    failover_priority = 0');
    lines.push('  }');
    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_cosmosdb_account',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
