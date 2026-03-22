import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const raiPolicyHclGenerator: HclGenerator = {
  typeId: 'azurerm/ai/rai_policy',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const basePolicyName = (props['base_policy_name'] as string) ?? 'Microsoft.DefaultV2';

    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const basePolicyExpr = context.getPropertyExpression(resource, 'base_policy_name', basePolicyName);

    const lines: string[] = [
      `resource "azurerm_cognitive_account_rai_policy" "${resource.terraformName}" {`,
      `  name                 = ${nameExpr}`,
    ];

    // cognitive_account_id from reference (required)
    const cognitiveAccountRef = resource.references['cognitive_account_id'];
    const cogAcctIdExpr = cognitiveAccountRef
      ? context.getAttributeReference(cognitiveAccountRef, 'id')
      : '"<cognitive-account-id>"';
    lines.push(`  cognitive_account_id = ${cogAcctIdExpr}`);

    lines.push(`  base_policy_name     = ${basePolicyExpr}`);
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_cognitive_account_rai_policy',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
