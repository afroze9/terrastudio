import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const userAssignedIdentityHclGenerator: HclGenerator = {
  typeId: 'azurerm/identity/user_assigned_identity',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;

    const rgExpr = context.getResourceGroupExpression();
    const locExpr = context.getLocationExpression();

    const lines: string[] = [
      `resource "azurerm_user_assigned_identity" "${resource.terraformName}" {`,
      `  name                = "${name}"`,
      `  resource_group_name = ${rgExpr}`,
      `  location            = ${locExpr}`,
      '',
      '  tags = local.common_tags',
      '}',
    ];

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_user_assigned_identity',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
