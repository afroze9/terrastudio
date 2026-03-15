import type { ResourceSchema } from '@terrastudio/types';

export const staticWebAppSchema: ResourceSchema = {
	typeId: 'azurerm/web/static_web_app',
	provider: 'azurerm',
	displayName: 'Static Web App',
	category: 'web',
	description: 'Azure Static Web App for hosting static content with optional API backend',
	terraformType: 'azurerm_static_web_app',
	supportsTags: true,
	requiresResourceGroup: true,
	cafAbbreviation: 'stapp',
	canBeChildOf: ['azurerm/core/resource_group'],
	privateEndpointConfig: {
		subresources: [{ key: 'staticSites', label: 'Static Web App' }],
		defaultSubresource: 'staticSites',
	},
	properties: [
		{
			key: 'name',
			label: 'Name',
			type: 'string',
			required: true,
			placeholder: 'stapp-mysite-dev',
			group: 'General',
			order: 1,
			validation: {
				minLength: 2,
				maxLength: 60,
				pattern: '^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$',
				patternMessage: 'Alphanumerics and hyphens',
			},
		},
		{
			key: 'sku_name',
			label: 'SKU',
			type: 'select',
			required: true,
			group: 'General',
			order: 2,
			defaultValue: 'Free',
			options: [
				{ label: 'Free', value: 'Free' },
				{ label: 'Standard', value: 'Standard' },
			],
		},
		{
			key: 'app_settings',
			label: 'App Settings',
			type: 'key-value-map',
			required: false,
			group: 'Configuration',
			order: 3,
			description: 'Application settings as key-value pairs',
		},
	],
	handles: [{ id: 'pep-target', type: 'target', position: 'left', label: 'Private Endpoint' }],
	outputs: [
		{ key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
		{ key: 'default_host_name', label: 'Default Hostname', terraformAttribute: 'default_host_name' },
		{ key: 'api_key', label: 'API Key', terraformAttribute: 'api_key', sensitive: true },
	],

	costEstimation: {
		serviceName: 'Static Web Apps',
		skuProperty: 'sku_name',
	},
};
