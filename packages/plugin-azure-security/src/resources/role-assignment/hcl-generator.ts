import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const roleAssignmentHclGenerator: HclGenerator = {
  typeId: 'azurerm/identity/role_assignment',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const roleName = (props['role_definition_name'] as string) ?? 'Reader';

    // Resolve principal reference (managed identity → principal_id)
    const principalRef = resource.references['principal_id'];
    const principalIdExpr = principalRef
      ? context.getAttributeReference(principalRef, 'principal_id')
      : '"<principal-id>"';

    // Resolve scope reference (target resource → id)
    const scopeRef = resource.references['scope'];
    const scopeExpr = scopeRef
      ? context.getAttributeReference(scopeRef, 'id')
      : '"<scope>"';

    const dependsOn: string[] = [];
    if (principalRef) {
      const addr = context.getTerraformAddress(principalRef);
      if (addr) dependsOn.push(addr);
    }
    if (scopeRef) {
      const addr = context.getTerraformAddress(scopeRef);
      if (addr) dependsOn.push(addr);
    }

    const lines: string[] = [
      `resource "azurerm_role_assignment" "${resource.terraformName}" {`,
      `  scope                = ${scopeExpr}`,
      `  role_definition_name = "${roleName}"`,
      `  principal_id         = ${principalIdExpr}`,
      '}',
    ];

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_role_assignment',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
