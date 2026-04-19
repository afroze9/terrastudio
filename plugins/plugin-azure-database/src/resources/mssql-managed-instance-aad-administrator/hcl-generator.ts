import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const mssqlManagedInstanceAadAdministratorHclGenerator: HclGenerator = {
  typeId: 'azurerm/database/mssql_managed_instance_aad_administrator',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const loginUsername = (props['login_username'] as string) ?? '';
    const objectId = (props['object_id'] as string) ?? '';
    const tenantId = (props['tenant_id'] as string) ?? '';
    const authOnly = props['azuread_authentication_only'] as boolean | undefined;

    const dependsOn: string[] = [];
    const miRef = resource.references['managed_instance_id'];
    const miIdExpr = miRef
      ? context.getAttributeReference(miRef, 'id')
      : '"<managed-instance-id>"';
    if (miRef) {
      const addr = context.getTerraformAddress(miRef);
      if (addr) dependsOn.push(addr);
    }

    const loginExpr = context.getPropertyExpression(resource, 'login_username', loginUsername);
    const objectIdExpr = context.getPropertyExpression(resource, 'object_id', objectId);
    const tenantIdExpr = context.getPropertyExpression(resource, 'tenant_id', tenantId);

    const lines: string[] = [
      `resource "azurerm_mssql_managed_instance_active_directory_administrator" "${resource.terraformName}" {`,
      `  managed_instance_id = ${miIdExpr}`,
      `  login_username      = ${loginExpr}`,
      `  object_id           = ${objectIdExpr}`,
      `  tenant_id           = ${tenantIdExpr}`,
    ];

    if (authOnly === true || resource.variableOverrides?.['azuread_authentication_only'] === 'variable') {
      const authOnlyExpr = context.getPropertyExpression(resource, 'azuread_authentication_only', authOnly ?? false);
      lines.push(`  azuread_authentication_only = ${authOnlyExpr}`);
    }

    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_mssql_managed_instance_active_directory_administrator',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
