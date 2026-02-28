import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';
import { escapeHclString as e } from '@terrastudio/core';

export const vmHclGenerator: HclGenerator = {
  typeId: 'azurerm/compute/virtual_machine',

  resolveTerraformType(properties: Record<string, unknown>): string {
    return (properties['os_type'] as string) === 'windows'
      ? 'azurerm_windows_virtual_machine'
      : 'azurerm_linux_virtual_machine';
  },

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const osType = (props['os_type'] as string) ?? 'linux';
    const size = (props['size'] as string) ?? 'Standard_B2s';
    const adminUsername = (props['admin_username'] as string) ?? 'azureuser';
    const imagePublisher = (props['image_publisher'] as string) ?? 'Canonical';
    const imageOffer = (props['image_offer'] as string) ?? '0001-com-ubuntu-server-jammy';
    const imageSku = (props['image_sku'] as string) ?? '22_04-lts';
    const osDiskSizeGb = props['os_disk_size_gb'] as number | undefined;
    const osDiskType = (props['os_disk_type'] as string) ?? 'Standard_LRS';

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);
    const dependsOn: string[] = [];

    // NIC resource name
    const nicName = `${resource.terraformName}_nic`;

    // Resolve subnet reference for the NIC
    const subnetRef = resource.references['subnet_id'];
    const subnetIdExpr = subnetRef
      ? context.getAttributeReference(subnetRef, 'id')
      : '"<subnet-id>"';

    if (subnetRef) {
      const subnetAddr = context.getTerraformAddress(subnetRef);
      if (subnetAddr) dependsOn.push(subnetAddr);
    }

    // Resolve public IP reference for the NIC
    const publicIpRef = resource.references['public_ip_id'];
    const publicIpIdExpr = publicIpRef
      ? context.getAttributeReference(publicIpRef, 'id')
      : undefined;

    if (publicIpRef) {
      const pipAddr = context.getTerraformAddress(publicIpRef);
      if (pipAddr) dependsOn.push(pipAddr);
    }

    const terraformType = osType === 'windows'
      ? 'azurerm_windows_virtual_machine'
      : 'azurerm_linux_virtual_machine';

    // Generate NIC
    const nicLines: string[] = [
      `resource "azurerm_network_interface" "${nicName}" {`,
      `  name                = "${e(name)}-nic"`,
      `  resource_group_name = ${rgExpr}`,
      `  location            = ${locExpr}`,
      '',
      '  ip_configuration {',
      '    name                          = "internal"',
      `    subnet_id                     = ${subnetIdExpr}`,
      '    private_ip_address_allocation = "Dynamic"',
    ];

    if (publicIpIdExpr) {
      nicLines.push(`    public_ip_address_id           = ${publicIpIdExpr}`);
    }

    nicLines.push(
      '  }',
      '',
      '  tags = local.common_tags',
      '}',
    );

    // Generate VM
    const vmLines: string[] = [
      `resource "${terraformType}" "${resource.terraformName}" {`,
      `  name                = "${e(name)}"`,
      `  resource_group_name = ${rgExpr}`,
      `  location            = ${locExpr}`,
      `  size                = "${e(size)}"`,
      `  admin_username      = "${e(adminUsername)}"`,
      '',
      `  network_interface_ids = [azurerm_network_interface.${nicName}.id]`,
    ];

    if (osType === 'windows') {
      const passwordVarName = `${resource.terraformName}_admin_password`;
      context.addVariable({
        name: passwordVarName,
        type: 'string',
        description: `Admin password for Windows VM ${name}`,
        sensitive: true,
      });
      vmLines.push(`  admin_password      = var.${passwordVarName}`);
    } else {
      const sshKeyVarName = `${resource.terraformName}_ssh_public_key`;
      context.addVariable({
        name: sshKeyVarName,
        type: 'string',
        description: `SSH public key for Linux VM ${name}`,
        sensitive: false,
      });
      vmLines.push('');
      vmLines.push('  admin_ssh_key {');
      vmLines.push(`    username   = "${e(adminUsername)}"`);
      vmLines.push(`    public_key = var.${sshKeyVarName}`);
      vmLines.push('  }');

      vmLines.push('');
      vmLines.push('  disable_password_authentication = true');
    }

    vmLines.push('');
    vmLines.push('  os_disk {');
    vmLines.push('    caching              = "ReadWrite"');
    vmLines.push(`    storage_account_type = "${e(osDiskType)}"`);
    if (osDiskSizeGb) {
      vmLines.push(`    disk_size_gb         = ${osDiskSizeGb}`);
    }
    vmLines.push('  }');

    vmLines.push('');
    vmLines.push('  source_image_reference {');
    vmLines.push(`    publisher = "${e(imagePublisher)}"`);
    vmLines.push(`    offer     = "${e(imageOffer)}"`);
    vmLines.push(`    sku       = "${e(imageSku)}"`);
    vmLines.push('    version   = "latest"');
    vmLines.push('  }');

    vmLines.push('');
    vmLines.push('  tags = local.common_tags');
    vmLines.push('}');

    const blocks: HclBlock[] = [
      {
        blockType: 'resource',
        terraformType: 'azurerm_network_interface',
        name: nicName,
        content: nicLines.join('\n'),
        dependsOn,
      },
      {
        blockType: 'resource',
        terraformType: terraformType,
        name: resource.terraformName,
        content: vmLines.join('\n'),
        dependsOn: [`azurerm_network_interface.${nicName}`],
      },
    ];

    // NSG association via reference property (attaches to NIC)
    const nsgRef = resource.references['nsg_id'];
    if (nsgRef) {
      const nsgIdExpr = context.getAttributeReference(nsgRef, 'id');
      const assocDeps = [`azurerm_network_interface.${nicName}`];
      const nsgAddr = context.getTerraformAddress(nsgRef);
      if (nsgAddr) assocDeps.push(nsgAddr);

      const assocName = `${resource.terraformName}_nsg`;
      blocks.push({
        blockType: 'resource',
        terraformType: 'azurerm_network_interface_security_group_association',
        name: assocName,
        content: [
          `resource "azurerm_network_interface_security_group_association" "${assocName}" {`,
          `  network_interface_id      = azurerm_network_interface.${nicName}.id`,
          `  network_security_group_id = ${nsgIdExpr}`,
          '}',
        ].join('\n'),
        dependsOn: assocDeps,
      });
    }

    return blocks;
  },
};
