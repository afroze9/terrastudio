import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const redisCacheHclGenerator: HclGenerator = {
  typeId: 'azurerm/database/redis_cache',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const skuName = (props['sku_name'] as string) ?? 'Standard';
    const family = skuName === 'Premium' ? 'P' : 'C';
    const capacity = props['capacity'] !== undefined ? Number(props['capacity']) : 1;
    const redisVersion = props['redis_version'] as string | undefined;
    const minTls = props['minimum_tls_version'] as string | undefined;
    const enableNonSsl = props['non_ssl_port_enabled'] as boolean | undefined;

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);

    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const skuExpr = context.getPropertyExpression(resource, 'sku_name', skuName);
    const capacityExpr = context.getPropertyExpression(resource, 'capacity', capacity);

    const lines: string[] = [
      `resource "azurerm_redis_cache" "${resource.terraformName}" {`,
      `  name                = ${nameExpr}`,
      `  location            = ${locExpr}`,
      `  resource_group_name = ${rgExpr}`,
      `  sku_name            = ${skuExpr}`,
      `  family              = "${family}"`,
      `  capacity            = ${capacityExpr}`,
    ];

    if (redisVersion) {
      const versionExpr = context.getPropertyExpression(resource, 'redis_version', redisVersion);
      lines.push(`  redis_version       = ${versionExpr}`);
    }

    const minTlsExpr = context.getPropertyExpression(resource, 'minimum_tls_version', minTls ?? '1.2');
    lines.push(`  minimum_tls_version  = ${minTlsExpr}`);

    const nonSslExpr = context.getPropertyExpression(resource, 'non_ssl_port_enabled', enableNonSsl === true);
    lines.push(`  non_ssl_port_enabled = ${nonSslExpr}`);

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_redis_cache',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
