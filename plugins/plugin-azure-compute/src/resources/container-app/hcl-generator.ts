import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';
import { escapeHclString as e } from '@terrastudio/core';

export const containerAppHclGenerator: HclGenerator = {
  typeId: 'azurerm/containers/container_app',
  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const revisionMode = (props['revision_mode'] as string) ?? 'Single';
    const containerImage = (props['container_image'] as string) ?? 'mcr.microsoft.com/k8se/quickstart:latest';
    const containerCpu = (props['container_cpu'] as string) ?? '0.25';
    const containerMemory = (props['container_memory'] as string) ?? '0.5Gi';
    const ingressEnabled = props['ingress_enabled'] as boolean | undefined;
    const ingressTargetPort = props['ingress_target_port'] as number | undefined;
    const ingressExternal = props['ingress_external'] as boolean ?? true;
    const envVars = props['environment_variables'] as Record<string, string> | undefined;
    const minReplicas = props['min_replicas'] as number | undefined;
    const maxReplicas = props['max_replicas'] as number | undefined;
    const secrets = props['secrets'] as Array<{ name: string; value: string }> | undefined;
    const identityEnabled = props['identity_enabled'] as boolean | undefined;
    const identityType = (props['identity_type'] as string) ?? 'SystemAssigned';

    const rgExpr = context.getResourceGroupExpression(resource);
    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const revisionModeExpr = context.getPropertyExpression(resource, 'revision_mode', revisionMode);

    const dependsOn: string[] = [];
    const envRef = resource.references['container_app_environment_id'];
    const envIdExpr = envRef ? context.getAttributeReference(envRef, 'id') : '"<environment-id>"';
    if (envRef) {
      const addr = context.getTerraformAddress(envRef);
      if (addr) dependsOn.push(addr);
    }

    const containerName = name ? name.replace(/[^a-z0-9-]/g, '-') : 'container';

    const lines: string[] = [
      `resource "azurerm_container_app" "${resource.terraformName}" {`,
      `  name                         = ${nameExpr}`,
      `  resource_group_name          = ${rgExpr}`,
      `  container_app_environment_id = ${envIdExpr}`,
      `  revision_mode                = ${revisionModeExpr}`,
      '',
      '  template {',
    ];

    if (minReplicas !== undefined || resource.variableOverrides?.['min_replicas'] === 'variable') {
      lines.push(`    min_replicas = ${context.getPropertyExpression(resource, 'min_replicas', minReplicas ?? 0)}`);
    }
    if (maxReplicas !== undefined || resource.variableOverrides?.['max_replicas'] === 'variable') {
      lines.push(`    max_replicas = ${context.getPropertyExpression(resource, 'max_replicas', maxReplicas ?? 10)}`);
    }

    lines.push('');
    lines.push('    container {');
    lines.push(`      name   = "${e(containerName)}"`);
    lines.push(`      image  = ${context.getPropertyExpression(resource, 'container_image', containerImage)}`);
    lines.push(`      cpu    = ${containerCpu}`);
    lines.push(`      memory = "${containerMemory}"`);

    if (envVars && Object.keys(envVars).length > 0) {
      for (const [key, value] of Object.entries(envVars)) {
        lines.push('');
        lines.push('      env {');
        lines.push(`        name  = "${e(key)}"`);
        lines.push(`        value = "${e(String(value))}"`);
        lines.push('      }');
      }
    }

    lines.push('    }');
    lines.push('  }');

    if (ingressEnabled) {
      lines.push('');
      lines.push('  ingress {');
      lines.push(`    external_enabled = ${context.getPropertyExpression(resource, 'ingress_external', ingressExternal)}`);
      lines.push(`    target_port      = ${context.getPropertyExpression(resource, 'ingress_target_port', ingressTargetPort ?? 80)}`);
      lines.push('    traffic_weight {');
      lines.push('      latest_revision = true');
      lines.push('      percentage      = 100');
      lines.push('    }');
      lines.push('  }');
    }

    if (secrets && secrets.length > 0) {
      for (const secret of secrets) {
        lines.push('');
        lines.push('  secret {');
        lines.push(`    name  = "${e(secret.name)}"`);
        lines.push(`    value = "${e(secret.value)}"`);
        lines.push('  }');
      }
    }

    if (identityEnabled) {
      lines.push('');
      lines.push('  identity {');
      lines.push(`    type = ${context.getPropertyExpression(resource, 'identity_type', identityType)}`);
      lines.push('  }');
    }

    lines.push('', '  tags = local.common_tags', '}');

    return [{ blockType: 'resource', terraformType: 'azurerm_container_app', name: resource.terraformName, content: lines.join('\n'), dependsOn }];
  },
};
