import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const applicationGatewayHclGenerator: HclGenerator = {
  typeId: 'azurerm/networking/application_gateway',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const skuName = (props['sku_name'] as string) ?? 'Standard_v2';
    const skuTier = (props['sku_tier'] as string) ?? 'Standard_v2';
    const capacity = props['capacity'] !== undefined ? Number(props['capacity']) : 2;
    const autoscaleMin = props['autoscale_min'] !== undefined ? Number(props['autoscale_min']) : undefined;
    const autoscaleMax = props['autoscale_max'] !== undefined ? Number(props['autoscale_max']) : undefined;
    const frontendPort = props['frontend_port'] !== undefined ? Number(props['frontend_port']) : 80;
    const backendFqdns = props['backend_fqdns'] as string[] | undefined;
    const backendPort = props['backend_port'] !== undefined ? Number(props['backend_port']) : 80;
    const backendProtocol = (props['backend_protocol'] as string) ?? 'Http';
    const cookieAffinity = (props['cookie_based_affinity'] as string) ?? 'Disabled';
    const requestTimeout = props['request_timeout'] !== undefined ? Number(props['request_timeout']) : 60;
    const wafEnabled = props['waf_enabled'] as boolean | undefined;
    const wafMode = (props['waf_mode'] as string) ?? 'Detection';
    const wafRuleSetVersion = (props['waf_rule_set_version'] as string) ?? '3.2';

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);
    const nameExpr = context.getPropertyExpression(resource, 'name', name);

    const subnetRef = resource.references['subnet_id'];
    const subnetIdExpr = subnetRef
      ? context.getAttributeReference(subnetRef, 'id')
      : '"<subnet-id>"';

    const pipRef = resource.references['pip_id'];
    const pipIdExpr = pipRef
      ? context.getAttributeReference(pipRef, 'id')
      : '"<public-ip-id>"';

    const dependsOn: string[] = [];
    if (subnetRef) {
      const addr = context.getTerraformAddress(subnetRef);
      if (addr) dependsOn.push(addr);
    }
    if (pipRef) {
      const addr = context.getTerraformAddress(pipRef);
      if (addr) dependsOn.push(addr);
    }

    // Internal name references (Application Gateway links nested blocks by name)
    const gwIpConfigName = `${name}-gwip`;
    const feIpConfigName = `${name}-feip`;
    const fePortName = `${name}-feport`;
    const bePoolName = `${name}-bepool`;
    const beHttpSettingsName = `${name}-behttps`;
    const listenerName = `${name}-httplstn`;
    const routingRuleName = `${name}-rqrt`;

    const lines: string[] = [
      `resource "azurerm_application_gateway" "${resource.terraformName}" {`,
      `  name                = ${nameExpr}`,
      `  location            = ${locExpr}`,
      `  resource_group_name = ${rgExpr}`,
    ];

    // SKU block
    lines.push('');
    lines.push('  sku {');
    lines.push(`    name = "${skuName}"`);
    lines.push(`    tier = "${skuTier}"`);
    // Only set capacity in sku if not using autoscale
    if (autoscaleMin === undefined) {
      lines.push(`    capacity = ${capacity}`);
    }
    lines.push('  }');

    // Autoscale configuration (if set)
    if (autoscaleMin !== undefined) {
      lines.push('');
      lines.push('  autoscale_configuration {');
      lines.push(`    min_capacity = ${autoscaleMin}`);
      if (autoscaleMax !== undefined) {
        lines.push(`    max_capacity = ${autoscaleMax}`);
      }
      lines.push('  }');
    }

    // Gateway IP configuration
    lines.push('');
    lines.push('  gateway_ip_configuration {');
    lines.push(`    name      = "${gwIpConfigName}"`);
    lines.push(`    subnet_id = ${subnetIdExpr}`);
    lines.push('  }');

    // Frontend IP configuration
    lines.push('');
    lines.push('  frontend_ip_configuration {');
    lines.push(`    name                 = "${feIpConfigName}"`);
    lines.push(`    public_ip_address_id = ${pipIdExpr}`);
    lines.push('  }');

    // Frontend port
    lines.push('');
    lines.push('  frontend_port {');
    lines.push(`    name = "${fePortName}"`);
    lines.push(`    port = ${frontendPort}`);
    lines.push('  }');

    // Backend address pool
    lines.push('');
    lines.push('  backend_address_pool {');
    lines.push(`    name = "${bePoolName}"`);
    if (backendFqdns && backendFqdns.length > 0) {
      lines.push(`    fqdns = [${backendFqdns.map((f) => `"${f}"`).join(', ')}]`);
    }
    lines.push('  }');

    // Backend HTTP settings
    lines.push('');
    lines.push('  backend_http_settings {');
    lines.push(`    name                  = "${beHttpSettingsName}"`);
    lines.push(`    cookie_based_affinity = "${cookieAffinity}"`);
    lines.push(`    port                  = ${backendPort}`);
    lines.push(`    protocol              = "${backendProtocol}"`);
    lines.push(`    request_timeout       = ${requestTimeout}`);
    lines.push('  }');

    // HTTP listener
    lines.push('');
    lines.push('  http_listener {');
    lines.push(`    name                           = "${listenerName}"`);
    lines.push(`    frontend_ip_configuration_name = "${feIpConfigName}"`);
    lines.push(`    frontend_port_name             = "${fePortName}"`);
    lines.push(`    protocol                       = "Http"`);
    lines.push('  }');

    // Request routing rule
    lines.push('');
    lines.push('  request_routing_rule {');
    lines.push(`    name                       = "${routingRuleName}"`);
    lines.push(`    priority                   = 9`);
    lines.push(`    rule_type                  = "Basic"`);
    lines.push(`    http_listener_name         = "${listenerName}"`);
    lines.push(`    backend_address_pool_name  = "${bePoolName}"`);
    lines.push(`    backend_http_settings_name = "${beHttpSettingsName}"`);
    lines.push('  }');

    // WAF configuration
    if (wafEnabled === true && skuName === 'WAF_v2') {
      lines.push('');
      lines.push('  waf_configuration {');
      lines.push('    enabled          = true');
      lines.push(`    firewall_mode    = "${wafMode}"`);
      lines.push('    rule_set_type    = "OWASP"');
      lines.push(`    rule_set_version = "${wafRuleSetVersion}"`);
      lines.push('  }');
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_application_gateway',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
