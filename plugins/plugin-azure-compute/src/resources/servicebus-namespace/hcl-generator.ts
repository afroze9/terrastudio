import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const serviceBusNamespaceHclGenerator: HclGenerator = {
  typeId: 'azurerm/messaging/servicebus_namespace',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const sku = (props['sku'] as string) ?? 'Standard';
    const capacity = props['capacity'] !== undefined ? Number(props['capacity']) : undefined;
    const zoneRedundant = props['zone_redundant'] as boolean | undefined;
    const localAuthEnabled = props['local_auth_enabled'] as boolean | undefined;
    const publicNetworkAccessEnabled = props['public_network_access_enabled'] as boolean | undefined;
    const minimumTlsVersion = props['minimum_tls_version'] as string | undefined;
    const identityEnabled = props['identity_enabled'] as boolean | undefined;
    const identityType = props['identity_type'] as string | undefined;

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);

    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const skuExpr = context.getPropertyExpression(resource, 'sku', sku);

    const lines: string[] = [
      `resource "azurerm_servicebus_namespace" "${resource.terraformName}" {`,
      `  name                = ${nameExpr}`,
      `  location            = ${locExpr}`,
      `  resource_group_name = ${rgExpr}`,
      `  sku                 = ${skuExpr}`,
    ];

    if (sku === 'Premium' && capacity !== undefined) {
      lines.push(`  capacity            = ${context.getPropertyExpression(resource, 'capacity', capacity)}`);
    }

    if (sku === 'Premium' && zoneRedundant === true) {
      lines.push(`  zone_redundant      = ${context.getPropertyExpression(resource, 'zone_redundant', zoneRedundant)}`);
    }

    if (localAuthEnabled === false) {
      lines.push(`  local_auth_enabled  = ${context.getPropertyExpression(resource, 'local_auth_enabled', localAuthEnabled)}`);
    }

    if (publicNetworkAccessEnabled === false) {
      lines.push(`  public_network_access_enabled = ${context.getPropertyExpression(resource, 'public_network_access_enabled', publicNetworkAccessEnabled)}`);
    }

    if (minimumTlsVersion && minimumTlsVersion !== '1.2') {
      lines.push(`  minimum_tls_version = ${context.getPropertyExpression(resource, 'minimum_tls_version', minimumTlsVersion)}`);
    }

    if (identityEnabled && identityType) {
      lines.push('');
      lines.push(`  identity {`);
      lines.push(`    type = ${context.getPropertyExpression(resource, 'identity_type', identityType)}`);
      lines.push(`  }`);
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_servicebus_namespace',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
