import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';
import { escapeHclString as e } from '@terrastudio/core';

export const functionAppHclGenerator: HclGenerator = {
  typeId: 'azurerm/compute/function_app',

  resolveTerraformType(properties: Record<string, unknown>): string {
    return (properties['os_type'] as string ?? '').toLowerCase() === 'windows'
      ? 'azurerm_windows_function_app'
      : 'azurerm_linux_function_app';
  },

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const osType = ((props['os_type'] as string) ?? 'linux').toLowerCase();
    const runtimeStack = props['runtime_stack'] as string | undefined;
    const runtimeVersion = props['runtime_version'] as string | undefined;
    const httpsOnly = props['https_only'] as boolean | undefined;
    const enabled = props['enabled'] as boolean | undefined;
    const http2Enabled = props['http2_enabled'] as boolean | undefined;
    const minimumTlsVersion = (props['minimum_tls_version'] as string) ?? '1.2';
    const appSettings = props['app_settings'] as Record<string, string> | undefined;
    const identityEnabled = props['identity_enabled'] as boolean | undefined;
    const identityType = (props['identity_type'] as string) ?? 'SystemAssigned';

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

    const nameExpr = context.getPropertyExpression(resource, 'name', name);

    const lines: string[] = [
      `resource "${terraformType}" "${resource.terraformName}" {`,
      `  name                       = ${nameExpr}`,
      `  resource_group_name        = ${rgExpr}`,
      `  location                   = ${locExpr}`,
      `  service_plan_id            = ${planIdExpr}`,
      `  storage_account_name       = ${storageNameExpr}`,
      `  storage_account_access_key = ${storageKeyExpr}`,
    ];

    if (httpsOnly !== false) {
      lines.push(`  https_only                 = ${context.getPropertyExpression(resource, 'https_only', true)}`);
    }

    if (enabled === false) {
      lines.push(`  enabled                    = ${context.getPropertyExpression(resource, 'enabled', false)}`);
    }

    // App settings
    if (appSettings && Object.keys(appSettings).length > 0) {
      lines.push('');
      lines.push('  app_settings = {');
      for (const [key, value] of Object.entries(appSettings)) {
        lines.push(`    ${e(key)} = "${e(String(value))}"`);
      }
      lines.push('  }');
    }

    // Identity block
    if (identityEnabled || resource.variableOverrides?.['identity_type'] === 'variable') {
      lines.push('');
      lines.push('  identity {');
      lines.push(`    type = ${context.getPropertyExpression(resource, 'identity_type', identityType)}`);
      lines.push('  }');
    }

    // site_config with application_stack (only if runtime is specified)
    lines.push('');
    lines.push('  site_config {');

    if (http2Enabled || resource.variableOverrides?.['http2_enabled'] === 'variable') {
      lines.push(`    http2_enabled        = ${context.getPropertyExpression(resource, 'http2_enabled', http2Enabled ?? false)}`);
    }

    lines.push(`    minimum_tls_version  = ${context.getPropertyExpression(resource, 'minimum_tls_version', minimumTlsVersion)}`);

    if (runtimeStack && runtimeVersion) {
      lines.push('    application_stack {');

      if (osType === 'linux') {
        switch (runtimeStack) {
          case 'node':
            lines.push(`      node_version    = "${e(runtimeVersion)}"`);
            break;
          case 'python':
            lines.push(`      python_version  = "${e(runtimeVersion)}"`);
            break;
          case 'dotnet':
          case 'dotnet-isolated':
            lines.push(`      dotnet_version  = "${e(runtimeVersion)}"`);
            lines.push(`      use_dotnet_isolated_runtime = ${runtimeStack === 'dotnet-isolated' ? 'true' : 'false'}`);
            break;
          case 'java':
            lines.push(`      java_version    = "${e(runtimeVersion)}"`);
            break;
          case 'powershell':
            lines.push(`      powershell_core_version = "${e(runtimeVersion)}"`);
            break;
        }
      } else {
        // Windows function app
        switch (runtimeStack) {
          case 'node':
            lines.push(`      node_version    = "~${e(runtimeVersion)}"`);
            break;
          case 'dotnet':
          case 'dotnet-isolated':
            lines.push(`      dotnet_version  = "v${e(runtimeVersion)}"`);
            lines.push(`      use_dotnet_isolated_runtime = ${runtimeStack === 'dotnet-isolated' ? 'true' : 'false'}`);
            break;
          case 'java':
            lines.push(`      java_version    = "${e(runtimeVersion)}"`);
            break;
          case 'powershell':
            lines.push(`      powershell_core_version = "${e(runtimeVersion)}"`);
            break;
        }
      }

      lines.push('    }');
    } else {
      // Omit empty application_stack — Terraform requires at least one runtime field
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
