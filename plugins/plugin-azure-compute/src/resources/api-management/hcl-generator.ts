import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const apiManagementHclGenerator: HclGenerator = {
  typeId: 'azurerm/integration/api_management',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const publisherName = props['publisher_name'] as string;
    const publisherEmail = props['publisher_email'] as string;
    const skuName = (props['sku_name'] as string) ?? 'Developer_1';
    const vnetType = (props['virtual_network_type'] as string) ?? 'None';
    const publicAccess = props['public_network_access_enabled'] as boolean | undefined;
    const clientCertEnabled = props['client_certificate_enabled'] as boolean | undefined;
    const gatewayDisabled = props['gateway_disabled'] as boolean | undefined;
    const notificationEmail = props['notification_sender_email'] as string | undefined;
    const identityEnabled = props['identity_enabled'] as boolean | undefined;
    const identityType = (props['identity_type'] as string) ?? 'SystemAssigned';
    const minApiVersion = props['min_api_version'] as string | undefined;
    const zones = props['zones'] as string[] | undefined;

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);
    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const publisherNameExpr = context.getPropertyExpression(resource, 'publisher_name', publisherName);
    const publisherEmailExpr = context.getPropertyExpression(resource, 'publisher_email', publisherEmail);
    const skuExpr = context.getPropertyExpression(resource, 'sku_name', skuName);

    const subnetRef = resource.references['subnet_id'];
    const subnetIdExpr = subnetRef
      ? context.getAttributeReference(subnetRef, 'id')
      : '"<subnet-id>"';

    const dependsOn: string[] = [];
    if (subnetRef) {
      const addr = context.getTerraformAddress(subnetRef);
      if (addr) dependsOn.push(addr);
    }

    const lines: string[] = [
      `resource "azurerm_api_management" "${resource.terraformName}" {`,
      `  name                = ${nameExpr}`,
      `  location            = ${locExpr}`,
      `  resource_group_name = ${rgExpr}`,
      `  publisher_name      = ${publisherNameExpr}`,
      `  publisher_email     = ${publisherEmailExpr}`,
      `  sku_name            = ${skuExpr}`,
    ];

    // Virtual network type
    if (vnetType !== 'None') {
      const vnetTypeExpr = context.getPropertyExpression(resource, 'virtual_network_type', vnetType);
      lines.push(`  virtual_network_type = ${vnetTypeExpr}`);
    } else if (resource.variableOverrides?.['virtual_network_type'] === 'variable') {
      const vnetTypeExpr = context.getPropertyExpression(resource, 'virtual_network_type', 'None');
      lines.push(`  virtual_network_type = ${vnetTypeExpr}`);
    }

    // Public network access
    if (publicAccess === false) {
      const publicExpr = context.getPropertyExpression(resource, 'public_network_access_enabled', false);
      lines.push(`  public_network_access_enabled = ${publicExpr}`);
    } else if (resource.variableOverrides?.['public_network_access_enabled'] === 'variable') {
      const publicExpr = context.getPropertyExpression(resource, 'public_network_access_enabled', true);
      lines.push(`  public_network_access_enabled = ${publicExpr}`);
    }

    // Client certificate authentication
    if (clientCertEnabled) {
      const certExpr = context.getPropertyExpression(resource, 'client_certificate_enabled', true);
      lines.push(`  client_certificate_enabled = ${certExpr}`);
    } else if (resource.variableOverrides?.['client_certificate_enabled'] === 'variable') {
      const certExpr = context.getPropertyExpression(resource, 'client_certificate_enabled', false);
      lines.push(`  client_certificate_enabled = ${certExpr}`);
    }

    // Gateway disabled
    if (gatewayDisabled) {
      const gwExpr = context.getPropertyExpression(resource, 'gateway_disabled', true);
      lines.push(`  gateway_disabled = ${gwExpr}`);
    } else if (resource.variableOverrides?.['gateway_disabled'] === 'variable') {
      const gwExpr = context.getPropertyExpression(resource, 'gateway_disabled', false);
      lines.push(`  gateway_disabled = ${gwExpr}`);
    }

    // Notification sender email
    if (notificationEmail) {
      const emailExpr = context.getPropertyExpression(resource, 'notification_sender_email', notificationEmail);
      lines.push(`  notification_sender_email = ${emailExpr}`);
    } else if (resource.variableOverrides?.['notification_sender_email'] === 'variable') {
      const emailExpr = context.getPropertyExpression(resource, 'notification_sender_email', '');
      lines.push(`  notification_sender_email = ${emailExpr}`);
    }

    // Minimum API version
    if (minApiVersion) {
      const minExpr = context.getPropertyExpression(resource, 'min_api_version', minApiVersion);
      lines.push(`  min_api_version     = ${minExpr}`);
    } else if (resource.variableOverrides?.['min_api_version'] === 'variable') {
      const minExpr = context.getPropertyExpression(resource, 'min_api_version', '');
      lines.push(`  min_api_version     = ${minExpr}`);
    }

    // Availability zones
    if (zones && zones.length > 0) {
      const zonesStr = `[${zones.map((z) => `"${z}"`).join(', ')}]`;
      lines.push(`  zones               = ${zonesStr}`);
    }

    // VNet configuration block (required when vnet_type is not None)
    if (vnetType !== 'None') {
      lines.push('');
      lines.push('  virtual_network_configuration {');
      lines.push(`    subnet_id = ${subnetIdExpr}`);
      lines.push('  }');
    }

    // Identity block
    if (identityEnabled) {
      const identityExpr = context.getPropertyExpression(resource, 'identity_type', identityType);
      lines.push('');
      lines.push('  identity {');
      lines.push(`    type = ${identityExpr}`);
      lines.push('  }');
    } else if (resource.variableOverrides?.['identity_type'] === 'variable') {
      const identityExpr = context.getPropertyExpression(resource, 'identity_type', identityType);
      lines.push('');
      lines.push('  identity {');
      lines.push(`    type = ${identityExpr}`);
      lines.push('  }');
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_api_management',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
