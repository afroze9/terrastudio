import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const containerRegistryHclGenerator: HclGenerator = {
  typeId: 'azurerm/containers/container_registry',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const sku = (props['sku'] as string) ?? 'Basic';
    const adminEnabled = props['admin_enabled'] as boolean | undefined;
    const publicAccess = props['public_network_access_enabled'] as boolean | undefined;

    const rgExpr = context.getResourceGroupExpression();
    const locExpr = context.getLocationExpression();

    const lines: string[] = [
      `resource "azurerm_container_registry" "${resource.terraformName}" {`,
      `  name                = "${name}"`,
      `  resource_group_name = ${rgExpr}`,
      `  location            = ${locExpr}`,
      `  sku                 = "${sku}"`,
    ];

    if (adminEnabled === true) {
      lines.push('  admin_enabled       = true');
    }

    if (publicAccess === false) {
      lines.push('  public_network_access_enabled = false');
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_container_registry',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
