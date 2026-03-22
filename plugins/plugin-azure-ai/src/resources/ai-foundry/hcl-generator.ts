import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const aiFoundryHclGenerator: HclGenerator = {
  typeId: 'azurerm/ai/ai_foundry',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const friendlyName = props['friendly_name'] as string | undefined;
    const description = props['description'] as string | undefined;
    const publicNetworkAccess = props['public_network_access'] as string | undefined;

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);
    const dependsOn: string[] = [];

    const nameExpr = context.getPropertyExpression(resource, 'name', name);

    const lines: string[] = [
      `resource "azurerm_ai_foundry" "${resource.terraformName}" {`,
      `  name                = ${nameExpr}`,
      `  resource_group_name = ${rgExpr}`,
      `  location            = ${locExpr}`,
    ];

    if (friendlyName || resource.variableOverrides?.['friendly_name'] === 'variable') {
      const friendlyNameExpr = context.getPropertyExpression(resource, 'friendly_name', friendlyName ?? '');
      lines.push(`  friendly_name       = ${friendlyNameExpr}`);
    }

    if (description || resource.variableOverrides?.['description'] === 'variable') {
      const descExpr = context.getPropertyExpression(resource, 'description', description ?? '');
      lines.push(`  description         = ${descExpr}`);
    }

    if ((publicNetworkAccess && publicNetworkAccess !== 'Enabled') || resource.variableOverrides?.['public_network_access'] === 'variable') {
      const pnaExpr = context.getPropertyExpression(resource, 'public_network_access', publicNetworkAccess ?? 'Enabled');
      lines.push(`  public_network_access = ${pnaExpr}`);
    }

    // Required reference: key_vault_id
    const keyVaultRef = resource.references['key_vault_id'];
    const kvExpr = keyVaultRef
      ? context.getAttributeReference(keyVaultRef, 'id')
      : '"<key-vault-id>"';
    lines.push(`  key_vault_id        = ${kvExpr}`);
    if (keyVaultRef) {
      const kvAddr = context.getTerraformAddress(keyVaultRef);
      if (kvAddr) dependsOn.push(kvAddr);
    }

    // Required reference: storage_account_id
    const storageRef = resource.references['storage_account_id'];
    const saExpr = storageRef
      ? context.getAttributeReference(storageRef, 'id')
      : '"<storage-account-id>"';
    lines.push(`  storage_account_id  = ${saExpr}`);
    if (storageRef) {
      const saAddr = context.getTerraformAddress(storageRef);
      if (saAddr) dependsOn.push(saAddr);
    }

    // Optional reference: application_insights_id
    const appInsightsRef = resource.references['application_insights_id'];
    if (appInsightsRef) {
      const aiExpr = context.getAttributeReference(appInsightsRef, 'id');
      lines.push(`  application_insights_id = ${aiExpr}`);
      const aiAddr = context.getTerraformAddress(appInsightsRef);
      if (aiAddr) dependsOn.push(aiAddr);
    }

    // Optional reference: container_registry_id
    const containerRegistryRef = resource.references['container_registry_id'];
    if (containerRegistryRef) {
      const crExpr = context.getAttributeReference(containerRegistryRef, 'id');
      lines.push(`  container_registry_id = ${crExpr}`);
      const crAddr = context.getTerraformAddress(containerRegistryRef);
      if (crAddr) dependsOn.push(crAddr);
    }

    // Identity block (always SystemAssigned)
    lines.push('');
    lines.push('  identity {');
    lines.push('    type = "SystemAssigned"');
    lines.push('  }');

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_ai_foundry',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
