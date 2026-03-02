import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const applicationInsightsHclGenerator: HclGenerator = {
  typeId: 'azurerm/monitoring/application_insights',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const appType = (props['application_type'] as string) ?? 'web';
    const retention = props['retention_in_days'] as number | undefined;
    const dailyCap = props['daily_data_cap_in_gb'] as number | undefined;
    const sampling = props['sampling_percentage'] as number | undefined;

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);
    const dependsOn: string[] = [];

    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const appTypeExpr = context.getPropertyExpression(resource, 'application_type', appType);

    const lines: string[] = [
      `resource "azurerm_application_insights" "${resource.terraformName}" {`,
      `  name                = ${nameExpr}`,
      `  resource_group_name = ${rgExpr}`,
      `  location            = ${locExpr}`,
      `  application_type    = ${appTypeExpr}`,
    ];

    // Resolve Log Analytics Workspace reference
    const workspaceRef = resource.references['workspace_id'];
    if (workspaceRef) {
      const workspaceIdExpr = context.getAttributeReference(workspaceRef, 'id');
      lines.push(`  workspace_id        = ${workspaceIdExpr}`);
      const wsAddr = context.getTerraformAddress(workspaceRef);
      if (wsAddr) dependsOn.push(wsAddr);
    }

    if (retention && retention !== 90) {
      const retentionExpr = context.getPropertyExpression(resource, 'retention_in_days', retention);
      lines.push(`  retention_in_days   = ${retentionExpr}`);
    }

    if (dailyCap !== undefined) {
      const dailyCapExpr = context.getPropertyExpression(resource, 'daily_data_cap_in_gb', dailyCap);
      lines.push(`  daily_data_cap_in_gb = ${dailyCapExpr}`);
    }

    if (sampling !== undefined && sampling !== 100) {
      const samplingExpr = context.getPropertyExpression(resource, 'sampling_percentage', sampling);
      lines.push(`  sampling_percentage = ${samplingExpr}`);
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_application_insights',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
