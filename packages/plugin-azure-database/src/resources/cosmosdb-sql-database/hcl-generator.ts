import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const cosmosdbSqlDatabaseHclGenerator: HclGenerator = {
  typeId: 'azurerm/database/cosmosdb_sql_database',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const throughput = props['throughput'] as number | undefined;

    const dependsOn: string[] = [];

    const accountRef = resource.references['account_id'];
    const accountNameExpr = accountRef
      ? context.getAttributeReference(accountRef, 'name')
      : '"<account-name>"';
    const rgExpr = context.getResourceGroupExpression(resource);

    if (accountRef) {
      const accountAddr = context.getTerraformAddress(accountRef);
      if (accountAddr) dependsOn.push(accountAddr);
    }

    const lines: string[] = [
      `resource "azurerm_cosmosdb_sql_database" "${resource.terraformName}" {`,
      `  name                = "${name}"`,
      `  resource_group_name = ${rgExpr}`,
      `  account_name        = ${accountNameExpr}`,
    ];

    if (throughput !== undefined && throughput > 0) {
      lines.push(`  throughput          = ${throughput}`);
    }

    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_cosmosdb_sql_database',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
