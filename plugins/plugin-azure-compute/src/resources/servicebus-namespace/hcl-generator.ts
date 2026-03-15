import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const serviceBusNamespaceHclGenerator: HclGenerator = {
  typeId: 'azurerm/messaging/servicebus_namespace',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const sku = (props['sku'] as string) ?? 'Standard';
    const capacity = props['capacity'] !== undefined ? Number(props['capacity']) : undefined;
    const zoneRedundant = props['zone_redundant'] as boolean | undefined;

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);

    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const skuExpr = context.getPropertyExpression(resource, 'sku', sku);

    const lines: string[] = [
      `resource "azurerm_servicebus_namespace" "${resource.terraformName}" {`,
      `  name                = ${nameExpr}`,
      `  location            = ${locExpr}`,
      `  resource_group_name = ${rgExpr}`,
      `  sku                 = ${skuExpr}`,
    ];

    if (sku === 'Premium' && capacity !== undefined) {
      lines.push(`  capacity            = ${context.getPropertyExpression(resource, 'capacity', capacity)}`);
    }

    if (sku === 'Premium' && zoneRedundant === true) {
      lines.push(`  zone_redundant      = ${context.getPropertyExpression(resource, 'zone_redundant', zoneRedundant)}`);
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_servicebus_namespace',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
