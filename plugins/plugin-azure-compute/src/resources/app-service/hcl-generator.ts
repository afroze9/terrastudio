import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';
import { escapeHclString as e } from '@terrastudio/core';

export const appServiceHclGenerator: HclGenerator = {
  typeId: 'azurerm/compute/app_service',

  resolveTerraformType(properties: Record<string, unknown>): string {
    return (properties['os_type'] as string ?? '').toLowerCase() === 'windows'
      ? 'azurerm_windows_web_app'
      : 'azurerm_linux_web_app';
  },

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const osType = ((props['os_type'] as string) ?? 'linux').toLowerCase();
    const runtimeStack = props['runtime_stack'] as string | undefined;
    const alwaysOn = props['always_on'] as boolean | undefined;
    const httpsOnly = props['https_only'] as boolean | undefined;
    const clientCertEnabled = props['client_cert_enabled'] as boolean | undefined;
    const minimumTlsVersion = (props['minimum_tls_version'] as string) ?? '1.2';
    const http2Enabled = props['http2_enabled'] as boolean | undefined;
    const healthCheckPath = props['health_check_path'] as string | undefined;
    const appSettings = props['app_settings'] as Record<string, string> | undefined;
    const identityEnabled = props['identity_enabled'] as boolean | undefined;
    const identityType = (props['identity_type'] as string) ?? 'SystemAssigned';

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);
    const dependsOn: string[] = [];

    // Resolve App Service Plan reference
    const planRef = resource.references['service_plan_id'];
    const planIdExpr = planRef
      ? context.getAttributeReference(planRef, 'id')
      : '"<service-plan-id>"';

    if (planRef) {
      const planAddr = context.getTerraformAddress(planRef);
      if (planAddr) dependsOn.push(planAddr);
    }

    // Resolve VNet integration subnet reference
    const subnetRef = resource.references['vnet_integration_subnet_id'];
    let subnetIdExpr: string | undefined;
    if (subnetRef) {
      subnetIdExpr = context.getAttributeReference(subnetRef, 'id');
      const subnetAddr = context.getTerraformAddress(subnetRef);
      if (subnetAddr) dependsOn.push(subnetAddr);
    }

    const terraformType = osType === 'windows'
      ? 'azurerm_windows_web_app'
      : 'azurerm_linux_web_app';

    const nameExpr = context.getPropertyExpression(resource, 'name', name);

    const lines: string[] = [
      `resource "${terraformType}" "${resource.terraformName}" {`,
      `  name                = ${nameExpr}`,
      `  resource_group_name = ${rgExpr}`,
      `  location            = ${locExpr}`,
      `  service_plan_id     = ${planIdExpr}`,
    ];

    if (subnetIdExpr) {
      lines.push(`  virtual_network_subnet_id = ${subnetIdExpr}`);
    }

    if (httpsOnly !== false) {
      lines.push(`  https_only          = ${context.getPropertyExpression(resource, 'https_only', true)}`);
    }

    if (clientCertEnabled) {
      lines.push(`  client_certificate_enabled = ${context.getPropertyExpression(resource, 'client_cert_enabled', clientCertEnabled)}`);
    }

    lines.push(`  minimum_tls_version = ${context.getPropertyExpression(resource, 'minimum_tls_version', minimumTlsVersion)}`);

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

    lines.push('');
    lines.push('  site_config {');

    if (alwaysOn) {
      lines.push(`    always_on = ${context.getPropertyExpression(resource, 'always_on', alwaysOn)}`);
    }

    if (http2Enabled || resource.variableOverrides?.['http2_enabled'] === 'variable') {
      lines.push(`    http2_enabled = ${context.getPropertyExpression(resource, 'http2_enabled', http2Enabled ?? false)}`);
    }

    if (healthCheckPath || resource.variableOverrides?.['health_check_path'] === 'variable') {
      lines.push(`    health_check_path = ${context.getPropertyExpression(resource, 'health_check_path', healthCheckPath ?? '')}`);
    }

    if (runtimeStack && osType === 'linux') {
      const [stack, version = ''] = runtimeStack.split('|');
      if (stack === 'NODE') {
        lines.push(`    application_stack {`);
        lines.push(`      node_version = "${e(version)}"`);
        lines.push('    }');
      } else if (stack === 'PYTHON') {
        lines.push('    application_stack {');
        lines.push(`      python_version = "${e(version)}"`);
        lines.push('    }');
      } else if (stack === 'DOTNETCORE') {
        lines.push('    application_stack {');
        lines.push(`      dotnet_version = "${e(version)}"`);
        lines.push('    }');
      } else if (stack === 'JAVA') {
        lines.push('    application_stack {');
        lines.push(`      java_version = "${e(version)}"`);
        lines.push('    }');
      } else if (stack === 'PHP') {
        lines.push('    application_stack {');
        lines.push(`      php_version = "${e(version)}"`);
        lines.push('    }');
      }
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
