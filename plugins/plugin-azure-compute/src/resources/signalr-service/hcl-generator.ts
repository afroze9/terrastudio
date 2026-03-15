import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const signalrServiceHclGenerator: HclGenerator = {
	typeId: 'azurerm/web/signalr_service',
	generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
		const props = resource.properties;
		const name = props['name'] as string;
		const skuName = (props['sku_name'] as string) ?? 'Free_F1';
		const capacity = Number(props['capacity'] ?? 1);
		const serviceMode = (props['service_mode'] as string) ?? 'Default';
		const connectivityLogs = props['connectivity_logs_enabled'] as boolean | undefined;
		const messagingLogs = props['messaging_logs_enabled'] as boolean | undefined;
		const liveTrace = props['live_trace_enabled'] as boolean | undefined;

		const rgExpr = context.getResourceGroupExpression(resource);
		const locExpr = context.getLocationExpression(resource);
		const nameExpr = context.getPropertyExpression(resource, 'name', name);

		const lines: string[] = [
			`resource "azurerm_signalr_service" "${resource.terraformName}" {`,
			`  name                = ${nameExpr}`,
			`  resource_group_name = ${rgExpr}`,
			`  location            = ${locExpr}`,
			'',
			'  sku {',
			`    name     = ${context.getPropertyExpression(resource, 'sku_name', skuName)}`,
			`    capacity = ${capacity}`,
			'  }',
		];

		if (serviceMode !== 'Default' || resource.variableOverrides?.['service_mode'] === 'variable') {
			lines.push(
				'',
				`  service_mode = ${context.getPropertyExpression(resource, 'service_mode', serviceMode)}`,
			);
		}

		if (connectivityLogs || resource.variableOverrides?.['connectivity_logs_enabled'] === 'variable') {
			lines.push(
				`  connectivity_logs_enabled = ${context.getPropertyExpression(resource, 'connectivity_logs_enabled', connectivityLogs ?? false)}`,
			);
		}

		if (messagingLogs || resource.variableOverrides?.['messaging_logs_enabled'] === 'variable') {
			lines.push(
				`  messaging_logs_enabled = ${context.getPropertyExpression(resource, 'messaging_logs_enabled', messagingLogs ?? false)}`,
			);
		}

		if (liveTrace || resource.variableOverrides?.['live_trace_enabled'] === 'variable') {
			lines.push(
				`  live_trace_enabled = ${context.getPropertyExpression(resource, 'live_trace_enabled', liveTrace ?? false)}`,
			);
		}

		lines.push('', '  tags = local.common_tags', '}');

		return [
			{
				blockType: 'resource',
				terraformType: 'azurerm_signalr_service',
				name: resource.terraformName,
				content: lines.join('\n'),
			},
		];
	},
};
