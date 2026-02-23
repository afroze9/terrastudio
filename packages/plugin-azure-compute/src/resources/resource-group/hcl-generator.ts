import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const resourceGroupHclGenerator: HclGenerator = {
  typeId: 'azurerm/core/resource_group',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const location = (props['location'] as string) ?? 'eastus';

    // Use getPropertyExpression to respect variable mode toggles
    const nameExpr = context.getPropertyExpression(resource, 'name', name, {
      variableName: `${resource.terraformName}_name`,
      variableType: 'string',
      variableDescription: `Name of the Resource Group`,
    });

    const locationExpr = context.getPropertyExpression(resource, 'location', location, {
      variableName: `${resource.terraformName}_location`,
      variableType: 'string',
      variableDescription: `Azure region for Resource Group ${name}`,
    });

    const lines: string[] = [
      `resource "azurerm_resource_group" "${resource.terraformName}" {`,
      `  name     = ${nameExpr}`,
      `  location = ${locationExpr}`,
      '',
      '  tags = local.common_tags',
      '}',
    ];

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_resource_group',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
