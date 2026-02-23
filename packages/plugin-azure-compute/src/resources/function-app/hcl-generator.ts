import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const functionAppHclGenerator: HclGenerator = {
  typeId: 'azurerm/compute/function_app',

  resolveTerraformType(properties: Record<string, unknown>): string {
    return (properties['os_type'] as string) === 'windows'
      ? 'azurerm_windows_function_app'
      : 'azurerm_linux_function_app';
  },

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const osType = (props['os_type'] as string) ?? 'linux';
    const runtimeStack = props['runtime_stack'] as string | undefined;
    const runtimeVersion = props['runtime_version'] as string | undefined;
    const httpsOnly = props['https_only'] as boolean | undefined;
    const enabled = props['enabled'] as boolean | undefined;

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);
    const dependsOn: string[] = [];

    const terraformType = osType === 'windows'
      ? 'azurerm_windows_function_app'
      : 'azurerm_linux_function_app';

    // Resolve App Service Plan reference (parent containment)
    const planRef = resource.references['service_plan_id'];
    const planIdExpr = planRef
      ? context.getAttributeReference(planRef, 'id')
      : '"<service-plan-id>"';

    if (planRef) {
      const planAddr = context.getTerraformAddress(planRef);
      if (planAddr) dependsOn.push(planAddr);
    }

    // Resolve Storage Account reference (cross-plugin reference)
    const storageRef = resource.references['storage_account_name'];
    const storageNameExpr = storageRef
      ? context.getAttributeReference(storageRef, 'name')
      : '"<storage-account-name>"';
    const storageKeyExpr = storageRef
      ? context.getAttributeReference(storageRef, 'primary_access_key')
      : '"<storage-account-key>"';

    if (storageRef) {
      const saAddr = context.getTerraformAddress(storageRef);
      if (saAddr) dependsOn.push(saAddr);
    }

    const lines: string[] = [
      `resource "${terraformType}" "${resource.terraformName}" {`,
      `  name                       = "${name}"`,
      `  resource_group_name        = ${rgExpr}`,
      `  location                   = ${locExpr}`,
      `  service_plan_id            = ${planIdExpr}`,
      `  storage_account_name       = ${storageNameExpr}`,
      `  storage_account_access_key = ${storageKeyExpr}`,
    ];

    if (httpsOnly !== false) {
      lines.push('  https_only                 = true');
    }

    if (enabled === false) {
      lines.push('  enabled                    = false');
    }

    // site_config with application_stack
    lines.push('');
    lines.push('  site_config {');

    if (runtimeStack && runtimeVersion) {
      lines.push('    application_stack {');

      if (osType === 'linux') {
        switch (runtimeStack) {
          case 'node':
            lines.push(`      node_version    = "${runtimeVersion}"`);
            break;
          case 'python':
            lines.push(`      python_version  = "${runtimeVersion}"`);
            break;
          case 'dotnet':
            lines.push(`      dotnet_version  = "${runtimeVersion}"`);
            break;
          case 'java':
            lines.push(`      java_version    = "${runtimeVersion}"`);
            break;
          case 'powershell':
            lines.push(`      powershell_core_version = "${runtimeVersion}"`);
            break;
        }
      } else {
        // Windows function app
        switch (runtimeStack) {
          case 'node':
            lines.push(`      node_version    = "~${runtimeVersion}"`);
            break;
          case 'dotnet':
            lines.push(`      dotnet_version  = "v${runtimeVersion}"`);
            break;
          case 'java':
            lines.push(`      java_version    = "${runtimeVersion}"`);
            break;
          case 'powershell':
            lines.push(`      powershell_core_version = "${runtimeVersion}"`);
            break;
        }
      }

      lines.push('    }');
    }

    lines.push('  }');
    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType,
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
