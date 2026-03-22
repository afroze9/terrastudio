import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const cognitiveDeploymentHclGenerator: HclGenerator = {
  typeId: 'azurerm/ai/cognitive_deployment',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const modelFormat = (props['model_format'] as string) ?? 'OpenAI';
    const modelName = (props['model_name'] as string) ?? 'gpt-4o';
    const modelVersion = props['model_version'] as string | undefined;
    const skuName = (props['sku_name'] as string) ?? 'Standard';
    const skuCapacity = props['sku_capacity'] as number | undefined;
    const versionUpgradeOption = props['version_upgrade_option'] as string | undefined;
    const raiPolicyName = props['rai_policy_name'] as string | undefined;

    const nameExpr = context.getPropertyExpression(resource, 'name', name);

    const lines: string[] = [
      `resource "azurerm_cognitive_deployment" "${resource.terraformName}" {`,
      `  name                 = ${nameExpr}`,
    ];

    // cognitive_account_id from reference (required)
    const cognitiveAccountRef = resource.references['cognitive_account_id'];
    const cogAcctIdExpr = cognitiveAccountRef
      ? context.getAttributeReference(cognitiveAccountRef, 'id')
      : '"<cognitive-account-id>"';
    lines.push(`  cognitive_account_id = ${cogAcctIdExpr}`);

    // model block
    lines.push('');
    lines.push('  model {');
    lines.push(`    format  = ${context.getPropertyExpression(resource, 'model_format', modelFormat)}`);
    lines.push(`    name    = ${context.getPropertyExpression(resource, 'model_name', modelName)}`);
    if (modelVersion || resource.variableOverrides?.['model_version'] === 'variable') {
      lines.push(`    version = ${context.getPropertyExpression(resource, 'model_version', modelVersion ?? '')}`);
    }
    lines.push('  }');

    // sku block
    lines.push('');
    lines.push('  sku {');
    lines.push(`    name     = ${context.getPropertyExpression(resource, 'sku_name', skuName)}`);
    if (skuCapacity !== undefined || resource.variableOverrides?.['sku_capacity'] === 'variable') {
      lines.push(`    capacity = ${context.getPropertyExpression(resource, 'sku_capacity', skuCapacity ?? 1)}`);
    }
    lines.push('  }');

    // optional top-level properties
    if (raiPolicyName || resource.variableOverrides?.['rai_policy_name'] === 'variable') {
      const expr = context.getPropertyExpression(resource, 'rai_policy_name', raiPolicyName ?? '');
      lines.push(`  rai_policy_name        = ${expr}`);
    }

    if (
      (versionUpgradeOption && versionUpgradeOption !== 'OnceNewDefaultVersionAvailable') ||
      resource.variableOverrides?.['version_upgrade_option'] === 'variable'
    ) {
      const expr = context.getPropertyExpression(resource, 'version_upgrade_option', versionUpgradeOption ?? 'OnceNewDefaultVersionAvailable');
      lines.push(`  version_upgrade_option = ${expr}`);
    }

    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_cognitive_deployment',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
