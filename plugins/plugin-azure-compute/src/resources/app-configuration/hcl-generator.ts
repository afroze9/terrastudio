import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const appConfigurationHclGenerator: HclGenerator = {
  typeId: 'azurerm/integration/app_configuration',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const sku = (props['sku'] as string) ?? 'standard';
    const publicAccess = (props['public_network_access'] as string) ?? 'Enabled';
    const localAuth = props['local_auth_enabled'] as boolean | undefined;
    const purgeProtection = props['purge_protection_enabled'] as boolean | undefined;
    const softDeleteDays = props['soft_delete_retention_days'] as number | undefined;
    const identityEnabled = props['identity_enabled'] as boolean | undefined;
    const identityType = (props['identity_type'] as string) ?? 'SystemAssigned';

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);
    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const skuExpr = context.getPropertyExpression(resource, 'sku', sku);

    const lines: string[] = [
      `resource "azurerm_app_configuration" "${resource.terraformName}" {`,
      `  name                = ${nameExpr}`,
      `  resource_group_name = ${rgExpr}`,
      `  location            = ${locExpr}`,
      `  sku                 = ${skuExpr}`,
    ];

    if (publicAccess !== 'Enabled' || resource.variableOverrides?.['public_network_access'] === 'variable') {
      const publicExpr = context.getPropertyExpression(resource, 'public_network_access', publicAccess);
      lines.push(`  public_network_access = ${publicExpr}`);
    }

    if (localAuth === false || resource.variableOverrides?.['local_auth_enabled'] === 'variable') {
      const localAuthExpr = context.getPropertyExpression(resource, 'local_auth_enabled', localAuth ?? true);
      lines.push(`  local_auth_enabled  = ${localAuthExpr}`);
    }

    if (purgeProtection === true || resource.variableOverrides?.['purge_protection_enabled'] === 'variable') {
      const purgeExpr = context.getPropertyExpression(resource, 'purge_protection_enabled', purgeProtection ?? false);
      lines.push(`  purge_protection_enabled = ${purgeExpr}`);
    }

    if ((softDeleteDays !== undefined && softDeleteDays !== 7) || resource.variableOverrides?.['soft_delete_retention_days'] === 'variable') {
      const daysExpr = context.getPropertyExpression(resource, 'soft_delete_retention_days', softDeleteDays ?? 7);
      lines.push(`  soft_delete_retention_days = ${daysExpr}`);
    }

    if (identityEnabled) {
      const identityExpr = context.getPropertyExpression(resource, 'identity_type', identityType);
      lines.push('');
      lines.push('  identity {');
      lines.push(`    type = ${identityExpr}`);
      lines.push('  }');
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_app_configuration',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
