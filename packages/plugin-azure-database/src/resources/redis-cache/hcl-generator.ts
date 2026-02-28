import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';
import { escapeHclString as e } from '@terrastudio/core';

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

    const lines: string[] = [
      `resource "azurerm_redis_cache" "${resource.terraformName}" {`,
      `  name                = "${e(name)}"`,
      `  location            = ${locExpr}`,
      `  resource_group_name = ${rgExpr}`,
      `  sku_name            = "${e(skuName)}"`,
      `  family              = "${e(family)}"`,
      `  capacity            = ${capacity}`,
    ];

    if (redisVersion) {
      lines.push(`  redis_version       = "${e(redisVersion)}"`);
    }

    lines.push(`  minimum_tls_version  = "${e(minTls ?? '1.2')}"`);
    lines.push(`  non_ssl_port_enabled = ${enableNonSsl === true}`);

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
