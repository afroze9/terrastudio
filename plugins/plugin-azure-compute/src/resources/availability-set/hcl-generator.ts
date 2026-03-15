import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const availabilitySetHclGenerator: HclGenerator = {
  typeId: 'azurerm/compute/availability_set',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const faultDomains = Number(props['platform_fault_domain_count'] ?? 2);
    const updateDomains = Number(props['platform_update_domain_count'] ?? 5);
    const managed = props['managed'] as boolean | undefined;

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);

    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const faultDomainsExpr = context.getPropertyExpression(resource, 'platform_fault_domain_count', faultDomains);
    const updateDomainsExpr = context.getPropertyExpression(resource, 'platform_update_domain_count', updateDomains);

    const lines: string[] = [
      `resource "azurerm_availability_set" "${resource.terraformName}" {`,
      `  name                         = ${nameExpr}`,
      `  resource_group_name          = ${rgExpr}`,
      `  location                     = ${locExpr}`,
      `  platform_fault_domain_count  = ${faultDomainsExpr}`,
      `  platform_update_domain_count = ${updateDomainsExpr}`,
    ];

    if (managed === false) {
      const managedExpr = context.getPropertyExpression(resource, 'managed', managed);
      lines.push(`  managed                      = ${managedExpr}`);
    }

    lines.push('', '  tags = local.common_tags', '}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_availability_set',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
