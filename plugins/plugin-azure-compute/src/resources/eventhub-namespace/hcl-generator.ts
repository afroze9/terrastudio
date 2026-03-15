import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const eventhubNamespaceHclGenerator: HclGenerator = {
  typeId: 'azurerm/messaging/eventhub_namespace',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const sku = (props['sku'] as string) ?? 'Standard';
    const capacity = props['capacity'] !== undefined ? Number(props['capacity']) : undefined;
    const autoInflate = props['auto_inflate_enabled'] as boolean | undefined;
    const maxThroughput = props['maximum_throughput_units'] !== undefined ? Number(props['maximum_throughput_units']) : undefined;

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);

    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const skuExpr = context.getPropertyExpression(resource, 'sku', sku);

    const lines: string[] = [
      `resource "azurerm_eventhub_namespace" "${resource.terraformName}" {`,
      `  name                = ${nameExpr}`,
      `  location            = ${locExpr}`,
      `  resource_group_name = ${rgExpr}`,
      `  sku                 = ${skuExpr}`,
    ];

    if (sku !== 'Basic' && capacity !== undefined) {
      lines.push(`  capacity            = ${context.getPropertyExpression(resource, 'capacity', capacity)}`);
    }

    if (sku === 'Standard' && autoInflate === true) {
      lines.push(`  auto_inflate_enabled         = ${context.getPropertyExpression(resource, 'auto_inflate_enabled', autoInflate)}`);

      if (maxThroughput !== undefined) {
        lines.push(`  maximum_throughput_units     = ${context.getPropertyExpression(resource, 'maximum_throughput_units', maxThroughput)}`);
      }
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_eventhub_namespace',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
