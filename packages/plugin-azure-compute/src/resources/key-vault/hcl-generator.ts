import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const keyVaultHclGenerator: HclGenerator = {
  typeId: 'azurerm/security/key_vault',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const skuName = (props['sku_name'] as string) ?? 'standard';
    const softDeleteDays = props['soft_delete_retention_days'] as number | undefined;
    const purgeProtection = props['purge_protection_enabled'] as boolean | undefined;
    const forDeployment = props['enabled_for_deployment'] as boolean | undefined;
    const forDiskEncryption = props['enabled_for_disk_encryption'] as boolean | undefined;
    const forTemplateDeployment = props['enabled_for_template_deployment'] as boolean | undefined;

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);

    const lines: string[] = [
      `resource "azurerm_key_vault" "${resource.terraformName}" {`,
      `  name                = "${name}"`,
      `  resource_group_name = ${rgExpr}`,
      `  location            = ${locExpr}`,
      `  sku_name            = "${skuName}"`,
      '  tenant_id           = data.azurerm_client_config.current.tenant_id',
    ];

    if (softDeleteDays != null && softDeleteDays !== 90) {
      lines.push(`  soft_delete_retention_days = ${softDeleteDays}`);
    }

    if (purgeProtection) {
      lines.push('  purge_protection_enabled  = true');
    }

    if (forDeployment) {
      lines.push('  enabled_for_deployment = true');
    }

    if (forDiskEncryption) {
      lines.push('  enabled_for_disk_encryption = true');
    }

    if (forTemplateDeployment) {
      lines.push('  enabled_for_template_deployment = true');
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    // Also generate the data source for current client config
    const dataLines = [
      'data "azurerm_client_config" "current" {}',
    ];

    return [
      {
        blockType: 'data',
        terraformType: 'azurerm_client_config',
        name: 'current',
        content: dataLines.join('\n'),
      },
      {
        blockType: 'resource',
        terraformType: 'azurerm_key_vault',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
