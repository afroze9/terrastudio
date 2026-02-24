import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const appServiceHclGenerator: HclGenerator = {
  typeId: 'azurerm/compute/app_service',

  resolveTerraformType(properties: Record<string, unknown>): string {
    return (properties['os_type'] as string) === 'windows'
      ? 'azurerm_windows_web_app'
      : 'azurerm_linux_web_app';
  },

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const osType = (props['os_type'] as string) ?? 'linux';
    const runtimeStack = props['runtime_stack'] as string | undefined;
    const alwaysOn = props['always_on'] as boolean | undefined;
    const httpsOnly = props['https_only'] as boolean | undefined;

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

    const lines: string[] = [
      `resource "${terraformType}" "${resource.terraformName}" {`,
      `  name                = "${name}"`,
      `  resource_group_name = ${rgExpr}`,
      `  location            = ${locExpr}`,
      `  service_plan_id     = ${planIdExpr}`,
    ];

    if (subnetIdExpr) {
      lines.push(`  virtual_network_subnet_id = ${subnetIdExpr}`);
    }

    if (httpsOnly !== false) {
      lines.push('  https_only          = true');
    }

    lines.push('');
    lines.push('  site_config {');

    if (alwaysOn) {
      lines.push('    always_on = true');
    }

    if (runtimeStack && osType === 'linux') {
      const [stack, version] = runtimeStack.split('|');
      if (stack === 'NODE') {
        lines.push(`    application_stack {`);
        lines.push(`      node_version = "${version}"`);
        lines.push('    }');
      } else if (stack === 'PYTHON') {
        lines.push('    application_stack {');
        lines.push(`      python_version = "${version}"`);
        lines.push('    }');
      } else if (stack === 'DOTNETCORE') {
        lines.push('    application_stack {');
        lines.push(`      dotnet_version = "${version}"`);
        lines.push('    }');
      } else if (stack === 'JAVA') {
        lines.push('    application_stack {');
        lines.push(`      java_version = "${version}"`);
        lines.push('    }');
      } else if (stack === 'PHP') {
        lines.push('    application_stack {');
        lines.push(`      php_version = "${version}"`);
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
