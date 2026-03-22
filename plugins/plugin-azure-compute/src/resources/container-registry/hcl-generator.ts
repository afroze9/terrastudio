import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const containerRegistryHclGenerator: HclGenerator = {
  typeId: 'azurerm/containers/container_registry',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const sku = (props['sku'] as string) ?? 'Basic';
    const adminEnabled = props['admin_enabled'] as boolean | undefined;
    const publicAccess = props['public_network_access_enabled'] as boolean | undefined;
    const identityEnabled = props['identity_enabled'] as boolean | undefined;
    const identityType = (props['identity_type'] as string) ?? 'SystemAssigned';
    const dataEndpointEnabled = props['data_endpoint_enabled'] as boolean | undefined;
    const anonymousPullEnabled = props['anonymous_pull_enabled'] as boolean | undefined;

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);

    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const skuExpr = context.getPropertyExpression(resource, 'sku', sku);

    const lines: string[] = [
      `resource "azurerm_container_registry" "${resource.terraformName}" {`,
      `  name                = ${nameExpr}`,
      `  resource_group_name = ${rgExpr}`,
      `  location            = ${locExpr}`,
      `  sku                 = ${skuExpr}`,
    ];

    if (adminEnabled === true) {
      lines.push(`  admin_enabled       = ${context.getPropertyExpression(resource, 'admin_enabled', adminEnabled)}`);
    }

    if (publicAccess === false) {
      lines.push(`  public_network_access_enabled = ${context.getPropertyExpression(resource, 'public_network_access_enabled', publicAccess)}`);
    }

    if (dataEndpointEnabled === true || resource.variableOverrides?.['data_endpoint_enabled'] === 'variable') {
      lines.push(`  data_endpoint_enabled = ${context.getPropertyExpression(resource, 'data_endpoint_enabled', dataEndpointEnabled ?? false)}`);
    }

    if (anonymousPullEnabled === true || resource.variableOverrides?.['anonymous_pull_enabled'] === 'variable') {
      lines.push(`  anonymous_pull_enabled = ${context.getPropertyExpression(resource, 'anonymous_pull_enabled', anonymousPullEnabled ?? false)}`);
    }

    // Identity block
    if (identityEnabled || resource.variableOverrides?.['identity_type'] === 'variable') {
      lines.push('');
      lines.push('  identity {');
      lines.push(`    type = ${context.getPropertyExpression(resource, 'identity_type', identityType)}`);
      lines.push('  }');
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_container_registry',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
