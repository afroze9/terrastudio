import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const cdnEndpointHclGenerator: HclGenerator = {
  typeId: 'azurerm/web/cdn_endpoint',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const originHostName = props['origin_host_name'] as string;
    const isHttpAllowed = props['is_http_allowed'] as boolean | undefined;
    const isHttpsAllowed = props['is_https_allowed'] as boolean | undefined;
    const isCompressionEnabled = props['is_compression_enabled'] as boolean | undefined;
    const contentTypesToCompress = props['content_types_to_compress'] as string[] | undefined;
    const querystringCaching = props['querystring_caching_behaviour'] as string | undefined;

    const dependsOn: string[] = [];

    const profileRef = resource.references['profile_name'];
    const profileNameExpr = profileRef
      ? context.getAttributeReference(profileRef, 'name')
      : '"<cdn-profile-name>"';

    if (profileRef) {
      const addr = context.getTerraformAddress(profileRef);
      if (addr) dependsOn.push(addr);
    }

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);

    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const originHostNameExpr = context.getPropertyExpression(resource, 'origin_host_name', originHostName);

    const lines: string[] = [
      `resource "azurerm_cdn_endpoint" "${resource.terraformName}" {`,
      `  name                = ${nameExpr}`,
      `  profile_name        = ${profileNameExpr}`,
      `  resource_group_name = ${rgExpr}`,
      `  location            = ${locExpr}`,
    ];

    if (isHttpAllowed === false || resource.variableOverrides?.['is_http_allowed'] === 'variable') {
      lines.push(`  is_http_allowed     = ${context.getPropertyExpression(resource, 'is_http_allowed', isHttpAllowed ?? true)}`);
    }

    if (isHttpsAllowed === false || resource.variableOverrides?.['is_https_allowed'] === 'variable') {
      lines.push(`  is_https_allowed    = ${context.getPropertyExpression(resource, 'is_https_allowed', isHttpsAllowed ?? true)}`);
    }

    if (isCompressionEnabled === true || resource.variableOverrides?.['is_compression_enabled'] === 'variable') {
      lines.push(`  is_compression_enabled = ${context.getPropertyExpression(resource, 'is_compression_enabled', isCompressionEnabled ?? false)}`);
    }

    if ((contentTypesToCompress && contentTypesToCompress.length > 0) || resource.variableOverrides?.['content_types_to_compress'] === 'variable') {
      lines.push(`  content_types_to_compress = ${context.getPropertyExpression(resource, 'content_types_to_compress', contentTypesToCompress ?? [])}`);
    }

    if ((querystringCaching && querystringCaching !== 'IgnoreQueryString') || resource.variableOverrides?.['querystring_caching_behaviour'] === 'variable') {
      lines.push(`  querystring_caching_behaviour = ${context.getPropertyExpression(resource, 'querystring_caching_behaviour', querystringCaching ?? 'IgnoreQueryString')}`);
    }

    lines.push('');
    lines.push('  origin {');
    lines.push(`    name      = "primary"`);
    lines.push(`    host_name = ${originHostNameExpr}`);
    lines.push('  }');
    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_cdn_endpoint',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
