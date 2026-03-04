import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const keyVaultSecretHclGenerator: HclGenerator = {
  typeId: 'azurerm/security/key_vault_secret',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const value = (props['value'] as string) ?? '';
    const contentType = props['content_type'] as string | undefined;
    const expirationDate = props['expiration_date'] as string | undefined;

    const dependsOn: string[] = [];

    const kvRef = resource.references['key_vault_id'];
    const kvIdExpr = kvRef
      ? context.getAttributeReference(kvRef, 'id')
      : '"<key-vault-id>"';

    if (kvRef) {
      const addr = context.getTerraformAddress(kvRef);
      if (addr) dependsOn.push(addr);
    }

    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const valueExpr = context.getPropertyExpression(resource, 'value', value, {
      variableType: 'string',
      variableDescription: `Value for Key Vault secret ${name}`,
      sensitive: true,
    });

    const lines: string[] = [
      `resource "azurerm_key_vault_secret" "${resource.terraformName}" {`,
      `  name         = ${nameExpr}`,
      `  value        = ${valueExpr}`,
      `  key_vault_id = ${kvIdExpr}`,
    ];

    if (contentType || resource.variableOverrides?.['content_type'] === 'variable') {
      lines.push(`  content_type = ${context.getPropertyExpression(resource, 'content_type', contentType ?? '')}`);
    }

    if (expirationDate || resource.variableOverrides?.['expiration_date'] === 'variable') {
      lines.push(`  expiration_date = ${context.getPropertyExpression(resource, 'expiration_date', expirationDate ?? '')}`);
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_key_vault_secret',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
