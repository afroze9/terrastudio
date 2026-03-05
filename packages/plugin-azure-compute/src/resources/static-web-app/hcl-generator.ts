import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

const e = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

export const staticWebAppHclGenerator: HclGenerator = {
	typeId: 'azurerm/web/static_web_app',
	generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
		const props = resource.properties;
		const name = props['name'] as string;
		const skuName = (props['sku_name'] as string) ?? 'Free';
		const appSettings = props['app_settings'] as Record<string, string> | undefined;

		const rgExpr = context.getResourceGroupExpression(resource);
		const locExpr = context.getLocationExpression(resource);
		const nameExpr = context.getPropertyExpression(resource, 'name', name);
		const skuExpr = context.getPropertyExpression(resource, 'sku_name', skuName);

		const lines: string[] = [
			`resource "azurerm_static_web_app" "${resource.terraformName}" {`,
			`  name                = ${nameExpr}`,
			`  resource_group_name = ${rgExpr}`,
			`  location            = ${locExpr}`,
			`  sku_tier            = ${skuExpr}`,
			`  sku_size            = ${skuExpr}`,
		];

		if (appSettings && Object.keys(appSettings).length > 0) {
			lines.push('', '  app_settings = {');
			for (const [key, value] of Object.entries(appSettings)) {
				lines.push(`    ${e(key)} = "${e(String(value))}"`);
			}
			lines.push('  }');
		}

		lines.push('', '  tags = local.common_tags', '}');

		return [
			{
				blockType: 'resource',
				terraformType: 'azurerm_static_web_app',
				name: resource.terraformName,
				content: lines.join('\n'),
			},
		];
	},
};
