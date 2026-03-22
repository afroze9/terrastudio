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

    const blocks: HclBlock[] = [
      { blockType: 'resource', terraformType: 'azurerm_lb', name: resource.terraformName, content: lines.join('\n') },
    ];

    // Emit a health probe resource when configured
    const probeProtocol = (props['health_probe_protocol'] as string) ?? 'Tcp';
    const probePort = props['health_probe_port'] !== undefined ? Number(props['health_probe_port']) : 80;
    const probePath = props['health_probe_path'] as string | undefined;
    const hasProbeConfig = probeProtocol || resource.variableOverrides?.['health_probe_protocol'] === 'variable'
      || resource.variableOverrides?.['health_probe_port'] === 'variable';

    if (hasProbeConfig) {
      const probeName = `${resource.terraformName}_probe`;
      const probeLines: string[] = [
        `resource "azurerm_lb_probe" "${probeName}" {`,
        `  loadbalancer_id = azurerm_lb.${resource.terraformName}.id`,
        `  name            = "health-probe"`,
        `  protocol        = ${context.getPropertyExpression(resource, 'health_probe_protocol', probeProtocol)}`,
        `  port            = ${context.getPropertyExpression(resource, 'health_probe_port', probePort)}`,
      ];

      if ((probeProtocol === 'Http' || probeProtocol === 'Https') && probePath) {
        probeLines.push(`  request_path    = ${context.getPropertyExpression(resource, 'health_probe_path', probePath)}`);
      } else if (resource.variableOverrides?.['health_probe_path'] === 'variable') {
        probeLines.push(`  request_path    = ${context.getPropertyExpression(resource, 'health_probe_path', probePath ?? '')}`);
      }

      probeLines.push('}');
      blocks.push({
        blockType: 'resource',
        terraformType: 'azurerm_lb_probe',
        name: probeName,
        content: probeLines.join('\n'),
        dependsOn: [`azurerm_lb.${resource.terraformName}`],
      });
    }

    // Emit a backend address pool for VMSS / VM connections
    const poolName = `${resource.terraformName}_backend_pool`;
    const poolLines: string[] = [
      `resource "azurerm_lb_backend_address_pool" "${poolName}" {`,
      `  name            = "${name ? name.replace(/[^a-zA-Z0-9-]/g, '-') : 'default'}-backend"`,
      `  loadbalancer_id = azurerm_lb.${resource.terraformName}.id`,
      '}',
    ];
    blocks.push({
      blockType: 'resource',
      terraformType: 'azurerm_lb_backend_address_pool',
      name: poolName,
      content: poolLines.join('\n'),
      dependsOn: [`azurerm_lb.${resource.terraformName}`],
    });

    return blocks;
  },
};
