import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';
import { escapeHclString as e } from '@terrastudio/core';

export const diagnosticSettingHclGenerator: HclGenerator = {
  typeId: 'azurerm/monitoring/diagnostic_setting',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const destinationType = (props['destination_type'] as string) ?? 'log_analytics_workspace';
    const logAnalyticsDestinationType = props['log_analytics_destination_type'] as string | undefined;
    const enabledLogCategories = (props['enabled_log_categories'] as string[] | undefined) ?? [];
    const enabledMetrics = (props['enabled_metrics'] as string[] | undefined) ?? [];
    const ehAuthRuleId = props['eventhub_authorization_rule_id'] as string | undefined;
    const ehName = props['eventhub_name'] as string | undefined;

    const dependsOn: string[] = [];

    const targetRef = resource.references['target_resource_id'];
    const targetExpr = targetRef
      ? context.getAttributeReference(targetRef, 'id')
      : '"<target-resource-id>"';
    if (targetRef) {
      const addr = context.getTerraformAddress(targetRef);
      if (addr) dependsOn.push(addr);
    }

    const nameExpr = context.getPropertyExpression(resource, 'name', name);

    const lines: string[] = [
      `resource "azurerm_monitor_diagnostic_setting" "${resource.terraformName}" {`,
      `  name               = ${nameExpr}`,
      `  target_resource_id = ${targetExpr}`,
    ];

    if (destinationType === 'log_analytics_workspace') {
      const wsRef = resource.references['log_analytics_workspace_id'];
      const wsExpr = wsRef
        ? context.getAttributeReference(wsRef, 'id')
        : '"<workspace-id>"';
      lines.push(`  log_analytics_workspace_id = ${wsExpr}`);
      if (wsRef) {
        const addr = context.getTerraformAddress(wsRef);
        if (addr) dependsOn.push(addr);
      }
      if (logAnalyticsDestinationType && logAnalyticsDestinationType !== 'AzureDiagnostics') {
        lines.push(`  log_analytics_destination_type = "${e(logAnalyticsDestinationType)}"`);
      }
    } else if (destinationType === 'storage_account') {
      const saRef = resource.references['storage_account_id'];
      const saExpr = saRef
        ? context.getAttributeReference(saRef, 'id')
        : '"<storage-account-id>"';
      lines.push(`  storage_account_id = ${saExpr}`);
      if (saRef) {
        const addr = context.getTerraformAddress(saRef);
        if (addr) dependsOn.push(addr);
      }
    } else if (destinationType === 'eventhub') {
      if (ehAuthRuleId) {
        lines.push(`  eventhub_authorization_rule_id = "${e(ehAuthRuleId)}"`);
      }
      if (ehName) {
        lines.push(`  eventhub_name = "${e(ehName)}"`);
      }
    }

    for (const category of enabledLogCategories) {
      lines.push('');
      lines.push('  enabled_log {');
      lines.push(`    category_group = "${e(category)}"`);
      lines.push('  }');
    }

    for (const metric of enabledMetrics) {
      lines.push('');
      lines.push('  enabled_metric {');
      lines.push(`    category = "${e(metric)}"`);
      lines.push('  }');
    }

    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_monitor_diagnostic_setting',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
