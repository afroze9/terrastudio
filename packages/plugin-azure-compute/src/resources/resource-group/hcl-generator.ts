import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const resourceGroupHclGenerator: HclGenerator = {
  typeId: 'azurerm/core/resource_group',

  generate(resource: ResourceInstance, _context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const location = (props['location'] as string) ?? 'eastus';

    const lines: string[] = [
      `resource "azurerm_resource_group" "${resource.terraformName}" {`,
      `  name     = "${name}"`,
      `  location = "${location}"`,
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
