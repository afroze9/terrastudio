import type { BindingHclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

/**
 * Generic binding generator for Key Vault secrets.
 * Accepts any source resource — creates an azurerm_key_vault_secret
 * from the source's specified attribute.
 */
export const keyVaultSecretBinding: BindingHclGenerator = {
  // sourceType omitted = wildcard (any source resource)
  targetType: 'azurerm/security/key_vault',

  generate(
    source: ResourceInstance,
    target: ResourceInstance,
    context: HclGenerationContext,
    sourceAttribute: string,
  ): HclBlock[] {
    const attr = sourceAttribute;
    const suffix = attr.replace(/_/g, '-');
    const tfName = `${source.terraformName}_${attr}`;
    const secretName =
      `${(source.properties['name'] as string) || source.terraformName}-${suffix}`;
    const valueExpr = context.getAttributeReference(source.instanceId, attr);
    const kvIdExpr = context.getAttributeReference(target.instanceId, 'id');

    const lines = [
      `resource "azurerm_key_vault_secret" "${tfName}" {`,
      `  name         = "${secretName}"`,
      `  value        = ${valueExpr}`,
      `  key_vault_id = ${kvIdExpr}`,
      '}',
    ];

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_key_vault_secret',
        name: tfName,
        content: lines.join('\n'),
        dependsOn: [
          context.getTerraformAddress(source.instanceId),
          context.getTerraformAddress(target.instanceId),
        ].filter(Boolean) as string[],
      },
    ];
  },
};
