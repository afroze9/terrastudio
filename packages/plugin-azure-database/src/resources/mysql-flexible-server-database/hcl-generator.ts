import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const mysqlFlexibleServerDatabaseHclGenerator: HclGenerator = {
  typeId: 'azurerm/database/mysql_flexible_server_database',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const charset = (props['charset'] as string) ?? 'utf8mb4';
    const collation = (props['collation'] as string) ?? 'utf8mb4_unicode_ci';

    const dependsOn: string[] = [];

    const serverRef = resource.references['server_name'];
    const serverNameExpr = serverRef
      ? context.getAttributeReference(serverRef, 'name')
      : '"<server-name>"';

    if (serverRef) {
      const serverAddr = context.getTerraformAddress(serverRef);
      if (serverAddr) dependsOn.push(serverAddr);
    }

    const rgExpr = context.getResourceGroupExpression(resource);
    const nameExpr = context.getPropertyExpression(resource, 'name', name);

    const lines: string[] = [
      `resource "azurerm_mysql_flexible_server_database" "${resource.terraformName}" {`,
      `  name                = ${nameExpr}`,
      `  server_name         = ${serverNameExpr}`,
      `  resource_group_name = ${rgExpr}`,
    ];

    if (charset && charset !== 'utf8mb4') {
      const charsetExpr = context.getPropertyExpression(resource, 'charset', charset);
      lines.push(`  charset             = ${charsetExpr}`);
    }

    if (collation && collation !== 'utf8mb4_unicode_ci') {
      const collationExpr = context.getPropertyExpression(resource, 'collation', collation);
      lines.push(`  collation           = ${collationExpr}`);
    }

    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_mysql_flexible_server_database',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
