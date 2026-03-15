import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

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

    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const kindExpr = context.getPropertyExpression(resource, 'kind', kind);

    const lines: string[] = [
      `resource "azurerm_cosmosdb_account" "${resource.terraformName}" {`,
      `  name                = ${nameExpr}`,
      `  location            = ${locExpr}`,
      `  resource_group_name = ${rgExpr}`,
      `  offer_type          = "Standard"`,
      `  kind                = ${kindExpr}`,
    ];

    if (autoFailover !== false) {
      const failoverExpr = context.getPropertyExpression(resource, 'automatic_failover_enabled', true);
      lines.push(`  automatic_failover_enabled = ${failoverExpr}`);
    }

    if (multiWrite === true) {
      const multiWriteExpr = context.getPropertyExpression(resource, 'multiple_write_locations_enabled', true);
      lines.push(`  multiple_write_locations_enabled = ${multiWriteExpr}`);
    }

    if (geoRedundant === true) {
      const geoExpr = context.getPropertyExpression(resource, 'geo_redundant_backup_enabled', true);
      lines.push(`  geo_redundant_backup_enabled = ${geoExpr}`);
    }

    if (publicAccess === false) {
      const publicExpr = context.getPropertyExpression(resource, 'public_network_access_enabled', false);
      lines.push(`  public_network_access_enabled = ${publicExpr}`);
    }

    const consistencyExpr = context.getPropertyExpression(resource, 'consistency_level', consistencyLevel);

    lines.push('');
    lines.push('  consistency_policy {');
    lines.push(`    consistency_level = ${consistencyExpr}`);
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
