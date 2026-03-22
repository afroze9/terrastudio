import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const bastionHclGenerator: HclGenerator = {
  typeId: 'azurerm/networking/bastion_host',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const sku = (props['sku'] as string) ?? 'Basic';
    const copyPaste = props['copy_paste_enabled'] as boolean | undefined;
    const fileCopy = props['file_copy_enabled'] as boolean | undefined;
    const tunneling = props['tunneling_enabled'] as boolean | undefined;
    const ipConnect = props['ip_connect_enabled'] as boolean | undefined;
    const shareableLink = props['shareable_link_enabled'] as boolean | undefined;
    const scaleUnits = props['scale_units'] as number | undefined;

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);
    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const skuExpr = context.getPropertyExpression(resource, 'sku', sku);

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

    const lines: string[] = [
      `resource "azurerm_bastion_host" "${resource.terraformName}" {`,
      `  name                = ${nameExpr}`,
      `  location            = ${locExpr}`,
      `  resource_group_name = ${rgExpr}`,
      `  sku                 = ${skuExpr}`,
    ];

    if (copyPaste === false) {
      const copyPasteExpr = context.getPropertyExpression(resource, 'copy_paste_enabled', false);
      lines.push(`  copy_paste_enabled = ${copyPasteExpr}`);
    }

    if (ipConnect === true || resource.variableOverrides?.['ip_connect_enabled'] === 'variable') {
      const ipConnectExpr = context.getPropertyExpression(resource, 'ip_connect_enabled', ipConnect ?? false);
      lines.push(`  ip_connect_enabled = ${ipConnectExpr}`);
    }

    if (shareableLink === true || resource.variableOverrides?.['shareable_link_enabled'] === 'variable') {
      const shareableLinkExpr = context.getPropertyExpression(resource, 'shareable_link_enabled', shareableLink ?? false);
      lines.push(`  shareable_link_enabled = ${shareableLinkExpr}`);
    }

    if (sku === 'Standard') {
      if (fileCopy === true) {
        const fileCopyExpr = context.getPropertyExpression(resource, 'file_copy_enabled', true);
        lines.push(`  file_copy_enabled = ${fileCopyExpr}`);
      }
      if (tunneling === true) {
        const tunnelingExpr = context.getPropertyExpression(resource, 'tunneling_enabled', true);
        lines.push(`  tunneling_enabled = ${tunnelingExpr}`);
      }
      if (scaleUnits !== undefined && scaleUnits !== 2) {
        const scaleUnitsExpr = context.getPropertyExpression(resource, 'scale_units', scaleUnits);
        lines.push(`  scale_units = ${scaleUnitsExpr}`);
      }
    }

    lines.push('');
    lines.push('  ip_configuration {');
    lines.push('    name                 = "configuration"');
    lines.push(`    subnet_id            = ${subnetIdExpr}`);
    lines.push(`    public_ip_address_id = ${pipIdExpr}`);
    lines.push('  }');

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_bastion_host',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
