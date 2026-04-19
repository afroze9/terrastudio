import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const communicationServiceHclGenerator: HclGenerator = {
  typeId: 'azurerm/messaging/communication_service',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const dataLocation = (props['data_location'] as string) ?? 'United States';

    const rgExpr = context.getResourceGroupExpression(resource);
    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const dataLocExpr = context.getPropertyExpression(resource, 'data_location', dataLocation);

    const lines: string[] = [
      `resource "azurerm_communication_service" "${resource.terraformName}" {`,
      `  name                = ${nameExpr}`,
      `  resource_group_name = ${rgExpr}`,
      `  data_location       = ${dataLocExpr}`,
      '',
      '  tags = local.common_tags',
      '}',
    ];

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_communication_service',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
