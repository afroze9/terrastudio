import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const loadBalancerHclGenerator: HclGenerator = {
  typeId: 'azurerm/networking/load_balancer',
  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const sku = (props['sku'] as string) ?? 'Standard';
    const skuTier = (props['sku_tier'] as string) ?? 'Regional';
    const lbType = (props['lb_type'] as string) ?? 'internal';
    const frontendName = (props['frontend_name'] as string) ?? 'primary';
    const privateIpAllocation = (props['private_ip_address_allocation'] as string) ?? 'Dynamic';

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);
    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const skuExpr = context.getPropertyExpression(resource, 'sku', sku);

    const lines: string[] = [
      `resource "azurerm_lb" "${resource.terraformName}" {`,
      `  name                = ${nameExpr}`,
      `  resource_group_name = ${rgExpr}`,
      `  location            = ${locExpr}`,
      `  sku                 = ${skuExpr}`,
    ];

    if (skuTier !== 'Regional' || resource.variableOverrides?.['sku_tier'] === 'variable') {
      lines.push(`  sku_tier            = ${context.getPropertyExpression(resource, 'sku_tier', skuTier)}`);
    }

    lines.push('');
    lines.push('  frontend_ip_configuration {');
    lines.push(`    name = ${context.getPropertyExpression(resource, 'frontend_name', frontendName)}`);

    if (lbType === 'internal') {
      const subnetRef = resource.references['subnet_id'];
      if (subnetRef) {
        const subnetIdExpr = context.getAttributeReference(subnetRef, 'id');
        lines.push(`    subnet_id                     = ${subnetIdExpr}`);
      }
      lines.push(`    private_ip_address_allocation = ${context.getPropertyExpression(resource, 'private_ip_address_allocation', privateIpAllocation)}`);
    } else {
      const pipRef = resource.references['public_ip_id'];
      if (pipRef) {
        const pipIdExpr = context.getAttributeReference(pipRef, 'id');
        lines.push(`    public_ip_address_id = ${pipIdExpr}`);
      }
    }

    lines.push('  }');
    lines.push('', '  tags = local.common_tags', '}');

    return [{ blockType: 'resource', terraformType: 'azurerm_lb', name: resource.terraformName, content: lines.join('\n') }];
  },
};
