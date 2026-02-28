import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';
import { escapeHclString as e } from '@terrastudio/core';

export const bastionHclGenerator: HclGenerator = {
  typeId: 'azurerm/networking/bastion_host',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const sku = (props['sku'] as string) ?? 'Basic';
    const copyPaste = props['copy_paste_enabled'] as boolean | undefined;
    const fileCopy = props['file_copy_enabled'] as boolean | undefined;
    const tunneling = props['tunneling_enabled'] as boolean | undefined;
    const scaleUnits = props['scale_units'] as number | undefined;

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);

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
      `  name                = "${e(name)}"`,
      `  location            = ${locExpr}`,
      `  resource_group_name = ${rgExpr}`,
      `  sku                 = "${e(sku)}"`,
    ];

    if (copyPaste === false) {
      lines.push('  copy_paste_enabled = false');
    }

    if (sku === 'Standard') {
      if (fileCopy === true) {
        lines.push('  file_copy_enabled = true');
      }
      if (tunneling === true) {
        lines.push('  tunneling_enabled = true');
      }
      if (scaleUnits !== undefined && scaleUnits !== 2) {
        lines.push(`  scale_units = ${scaleUnits}`);
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
