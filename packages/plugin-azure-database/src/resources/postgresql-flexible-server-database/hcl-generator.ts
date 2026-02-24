import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const postgresqlFlexibleServerDatabaseHclGenerator: HclGenerator = {
  typeId: 'azurerm/database/postgresql_flexible_server_database',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const charset = (props['charset'] as string) ?? 'UTF8';
    const collation = (props['collation'] as string) ?? 'en_US.utf8';

    const dependsOn: string[] = [];

    const serverRef = resource.references['server_id'];
    const serverIdExpr = serverRef
      ? context.getAttributeReference(serverRef, 'id')
      : '"<server-id>"';

    if (serverRef) {
      const serverAddr = context.getTerraformAddress(serverRef);
      if (serverAddr) dependsOn.push(serverAddr);
    }

    const lines: string[] = [
      `resource "azurerm_postgresql_flexible_server_database" "${resource.terraformName}" {`,
      `  name      = "${name}"`,
      `  server_id = ${serverIdExpr}`,
    ];

    if (charset && charset !== 'UTF8') {
      lines.push(`  charset   = "${charset}"`);
    }

    if (collation && collation !== 'en_US.utf8') {
      lines.push(`  collation = "${collation}"`);
    }

    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_postgresql_flexible_server_database',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
