import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const aiFoundryProjectHclGenerator: HclGenerator = {
  typeId: 'azurerm/ai/ai_foundry_project',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const friendlyName = props['friendly_name'] as string | undefined;
    const description = props['description'] as string | undefined;

    const locExpr = context.getLocationExpression(resource);
    const dependsOn: string[] = [];

    const nameExpr = context.getPropertyExpression(resource, 'name', name);

    // Resolve AI Foundry Hub reference (parent containment)
    const hubRef = resource.references['ai_services_hub_id'];
    const hubIdExpr = hubRef
      ? context.getAttributeReference(hubRef, 'id')
      : '"<ai-services-hub-id>"';

    if (hubRef) {
      const hubAddr = context.getTerraformAddress(hubRef);
      if (hubAddr) dependsOn.push(hubAddr);
    }

    const lines: string[] = [
      `resource "azurerm_ai_foundry_project" "${resource.terraformName}" {`,
      `  name               = ${nameExpr}`,
      `  location           = ${locExpr}`,
      `  ai_services_hub_id = ${hubIdExpr}`,
    ];

    if (friendlyName || resource.variableOverrides?.['friendly_name'] === 'variable') {
      const friendlyNameExpr = context.getPropertyExpression(resource, 'friendly_name', friendlyName ?? '');
      lines.push(`  friendly_name      = ${friendlyNameExpr}`);
    }

    if (description || resource.variableOverrides?.['description'] === 'variable') {
      const descExpr = context.getPropertyExpression(resource, 'description', description ?? '');
      lines.push(`  description        = ${descExpr}`);
    }

    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_ai_foundry_project',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
