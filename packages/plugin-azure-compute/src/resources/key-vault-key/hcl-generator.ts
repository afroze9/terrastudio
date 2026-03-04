import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const keyVaultKeyHclGenerator: HclGenerator = {
  typeId: 'azurerm/security/key_vault_key',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const keyType = (props['key_type'] as string) ?? 'RSA';
    const keySize = props['key_size'] !== undefined ? Number(props['key_size']) : undefined;
    const curve = props['curve'] as string | undefined;
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
    const keyTypeExpr = context.getPropertyExpression(resource, 'key_type', keyType);

    const lines: string[] = [
      `resource "azurerm_key_vault_key" "${resource.terraformName}" {`,
      `  name         = ${nameExpr}`,
      `  key_vault_id = ${kvIdExpr}`,
      `  key_type     = ${keyTypeExpr}`,
    ];

    if ((keyType === 'RSA' || keyType === 'RSA-HSM') && (keySize || resource.variableOverrides?.['key_size'] === 'variable')) {
      lines.push(`  key_size     = ${context.getPropertyExpression(resource, 'key_size', keySize ?? 2048)}`);
    }

    if ((keyType === 'EC' || keyType === 'EC-HSM') && (curve || resource.variableOverrides?.['curve'] === 'variable')) {
      lines.push(`  curve        = ${context.getPropertyExpression(resource, 'curve', curve ?? 'P-256')}`);
    }

    lines.push('  key_opts     = ["decrypt", "encrypt", "sign", "unwrapKey", "verify", "wrapKey"]');

    if (expirationDate || resource.variableOverrides?.['expiration_date'] === 'variable') {
      lines.push(`  expiration_date = ${context.getPropertyExpression(resource, 'expiration_date', expirationDate ?? '')}`);
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_key_vault_key',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
