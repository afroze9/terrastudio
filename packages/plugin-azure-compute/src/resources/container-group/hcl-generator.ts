import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';
import { escapeHclString as e } from '@terrastudio/core';

export const containerGroupHclGenerator: HclGenerator = {
  typeId: 'azurerm/containers/container_group',
  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const osType = (props['os_type'] as string) ?? 'Linux';
    const containerImage = (props['container_image'] as string) ?? 'mcr.microsoft.com/azuredocs/aci-helloworld:latest';
    const containerCpu = props['container_cpu'] !== undefined ? Number(props['container_cpu']) : 1;
    const containerMemory = props['container_memory'] !== undefined ? Number(props['container_memory']) : 1.5;
    const containerPort = props['container_port'] as number ?? 80;
    const ipAddressType = (props['ip_address_type'] as string) ?? 'Public';
    const dnsNameLabel = props['dns_name_label'] as string | undefined;
    const restartPolicy = (props['restart_policy'] as string) ?? 'Always';

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);
    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const osTypeExpr = context.getPropertyExpression(resource, 'os_type', osType);
    const ipTypeExpr = context.getPropertyExpression(resource, 'ip_address_type', ipAddressType);

    const containerName = name ? name.replace(/[^a-z0-9-]/g, '-') : 'container';

    const lines: string[] = [
      `resource "azurerm_container_group" "${resource.terraformName}" {`,
      `  name                = ${nameExpr}`,
      `  resource_group_name = ${rgExpr}`,
      `  location            = ${locExpr}`,
      `  os_type             = ${osTypeExpr}`,
      `  ip_address_type     = ${ipTypeExpr}`,
    ];

    if (ipAddressType === 'Public' && (dnsNameLabel || resource.variableOverrides?.['dns_name_label'] === 'variable')) {
      lines.push(`  dns_name_label      = ${context.getPropertyExpression(resource, 'dns_name_label', dnsNameLabel ?? '')}`);
    }

    if (restartPolicy !== 'Always' || resource.variableOverrides?.['restart_policy'] === 'variable') {
      lines.push(`  restart_policy      = ${context.getPropertyExpression(resource, 'restart_policy', restartPolicy)}`);
    }

    lines.push('');
    lines.push('  container {');
    lines.push(`    name   = "${e(containerName)}"`);
    lines.push(`    image  = ${context.getPropertyExpression(resource, 'container_image', containerImage)}`);
    lines.push(`    cpu    = ${context.getPropertyExpression(resource, 'container_cpu', containerCpu)}`);
    lines.push(`    memory = ${context.getPropertyExpression(resource, 'container_memory', containerMemory)}`);
    lines.push('');
    lines.push('    ports {');
    lines.push(`      port     = ${context.getPropertyExpression(resource, 'container_port', containerPort)}`);
    lines.push('      protocol = "TCP"');
    lines.push('    }');
    lines.push('  }');

    lines.push('', '  tags = local.common_tags', '}');

    return [{ blockType: 'resource', terraformType: 'azurerm_container_group', name: resource.terraformName, content: lines.join('\n') }];
  },
};
