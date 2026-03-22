import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const cognitiveAccountHclGenerator: HclGenerator = {
  typeId: 'azurerm/ai/cognitive_account',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const kind = (props['kind'] as string) ?? 'OpenAI';
    const skuName = (props['sku_name'] as string) ?? 'S0';
    const customSubdomainName = props['custom_subdomain_name'] as string | undefined;
    const publicNetworkAccessEnabled = props['public_network_access_enabled'] as boolean | undefined;
    const localAuthEnabled = props['local_auth_enabled'] as boolean | undefined;

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);

    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const kindExpr = context.getPropertyExpression(resource, 'kind', kind);
    const skuExpr = context.getPropertyExpression(resource, 'sku_name', skuName);

    const lines: string[] = [
      `resource "azurerm_cognitive_account" "${resource.terraformName}" {`,
      `  name                = ${nameExpr}`,
      `  resource_group_name = ${rgExpr}`,
      `  location            = ${locExpr}`,
      `  kind                = ${kindExpr}`,
      `  sku_name            = ${skuExpr}`,
    ];

    if (customSubdomainName || resource.variableOverrides?.['custom_subdomain_name'] === 'variable') {
      const expr = context.getPropertyExpression(resource, 'custom_subdomain_name', customSubdomainName ?? '');
      lines.push(`  custom_subdomain_name = ${expr}`);
    }

    if (publicNetworkAccessEnabled === false || resource.variableOverrides?.['public_network_access_enabled'] === 'variable') {
      const expr = context.getPropertyExpression(resource, 'public_network_access_enabled', publicNetworkAccessEnabled ?? true);
      lines.push(`  public_network_access_enabled = ${expr}`);
    }

    if (localAuthEnabled === false || resource.variableOverrides?.['local_auth_enabled'] === 'variable') {
      const expr = context.getPropertyExpression(resource, 'local_auth_enabled', localAuthEnabled ?? true);
      lines.push(`  local_auth_enabled = ${expr}`);
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_cognitive_account',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
