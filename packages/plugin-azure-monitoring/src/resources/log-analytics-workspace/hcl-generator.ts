import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const logAnalyticsWorkspaceHclGenerator: HclGenerator = {
  typeId: 'azurerm/monitoring/log_analytics_workspace',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const sku = (props['sku'] as string) ?? 'PerGB2018';
    const retention = props['retention_in_days'] as number | undefined;
    const dailyQuota = props['daily_quota_gb'] as number | undefined;

    const rgExpr = context.getResourceGroupExpression();
    const locExpr = context.getLocationExpression();

    const lines: string[] = [
      `resource "azurerm_log_analytics_workspace" "${resource.terraformName}" {`,
      `  name                = "${name}"`,
      `  resource_group_name = ${rgExpr}`,
      `  location            = ${locExpr}`,
      `  sku                 = "${sku}"`,
    ];

    if (retention && retention !== 30) {
      lines.push(`  retention_in_days   = ${retention}`);
    }

    if (dailyQuota !== undefined && dailyQuota !== -1) {
      lines.push(`  daily_quota_gb      = ${dailyQuota}`);
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_log_analytics_workspace',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
