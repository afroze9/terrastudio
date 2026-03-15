import type {
	HclGenerator,
	HclBlock,
	ResourceInstance,
	HclGenerationContext,
} from '@terrastudio/types';

export const dnsCnameRecordHclGenerator: HclGenerator = {
	typeId: 'azurerm/dns/dns_cname_record',
	generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
		const props = resource.properties;
		const name = props['name'] as string;
		const ttl = (props['ttl'] as number) ?? 3600;
		const recordMode = (props['record_mode'] as string) ?? 'cname';
		const record = props['record'] as string | undefined;

		const rgExpr = context.getResourceGroupExpression(resource);
		const nameExpr = context.getPropertyExpression(resource, 'name', name);
		const ttlExpr = context.getPropertyExpression(resource, 'ttl', ttl);

		const dependsOn: string[] = [];

		// Resolve DNS zone reference - use zone_name, not zone_id
		const zoneRef = resource.references['dns_zone_id'];
		let zoneNameExpr = '"<zone-name>"';
		if (zoneRef) {
			zoneNameExpr = context.getAttributeReference(zoneRef, 'name');
			const zoneAddr = context.getTerraformAddress(zoneRef);
			if (zoneAddr) dependsOn.push(zoneAddr);
		}

		const lines: string[] = [
			`resource "azurerm_dns_cname_record" "${resource.terraformName}" {`,
			`  name                = ${nameExpr}`,
			`  zone_name           = ${zoneNameExpr}`,
			`  resource_group_name = ${rgExpr}`,
			`  ttl                 = ${ttlExpr}`,
		];

		if (recordMode === 'alias') {
			// Alias mode - point to Azure resource
			const targetRef = resource.references['target_resource_id'];
			if (targetRef) {
				const targetIdExpr = context.getAttributeReference(targetRef, 'id');
				lines.push(`  target_resource_id  = ${targetIdExpr}`);
				const targetAddr = context.getTerraformAddress(targetRef);
				if (targetAddr) dependsOn.push(targetAddr);
			}
		} else {
			// CNAME mode - singular record (not records!)
			if (record) {
				lines.push(
					`  record              = ${context.getPropertyExpression(resource, 'record', record)}`,
				);
			}
		}

		lines.push('', '  tags = local.common_tags', '}');

		return [
			{
				blockType: 'resource',
				terraformType: 'azurerm_dns_cname_record',
				name: resource.terraformName,
				content: lines.join('\n'),
				dependsOn: dependsOn.length > 0 ? dependsOn : undefined,
			},
		];
	},
};
