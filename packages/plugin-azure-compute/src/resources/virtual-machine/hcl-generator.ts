import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

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

    const rgExpr = context.getResourceGroupExpression();
    const locExpr = context.getLocationExpression();
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

    const terraformType = osType === 'windows'
      ? 'azurerm_windows_virtual_machine'
      : 'azurerm_linux_virtual_machine';

    // Generate NIC
    const nicLines: string[] = [
      `resource "azurerm_network_interface" "${nicName}" {`,
      `  name                = "${name}-nic"`,
      `  resource_group_name = ${rgExpr}`,
      `  location            = ${locExpr}`,
      '',
      '  ip_configuration {',
      '    name                          = "internal"',
      `    subnet_id                     = ${subnetIdExpr}`,
      '    private_ip_address_allocation = "Dynamic"',
      '  }',
      '',
      '  tags = local.common_tags',
      '}',
    ];

    // Generate VM
    const vmLines: string[] = [
      `resource "${terraformType}" "${resource.terraformName}" {`,
      `  name                = "${name}"`,
      `  resource_group_name = ${rgExpr}`,
      `  location            = ${locExpr}`,
      `  size                = "${size}"`,
      `  admin_username      = "${adminUsername}"`,
      '',
      `  network_interface_ids = [azurerm_network_interface.${nicName}.id]`,
    ];

    if (osType === 'linux') {
      vmLines.push('');
      vmLines.push('  admin_ssh_key {');
      vmLines.push(`    username   = "${adminUsername}"`);
      vmLines.push('    public_key = file("~/.ssh/id_rsa.pub")');
      vmLines.push('  }');

      vmLines.push('');
      vmLines.push('  disable_password_authentication = true');
    }

    vmLines.push('');
    vmLines.push('  os_disk {');
    vmLines.push('    caching              = "ReadWrite"');
    vmLines.push(`    storage_account_type = "${osDiskType}"`);
    if (osDiskSizeGb) {
      vmLines.push(`    disk_size_gb         = ${osDiskSizeGb}`);
    }
    vmLines.push('  }');

    vmLines.push('');
    vmLines.push('  source_image_reference {');
    vmLines.push(`    publisher = "${imagePublisher}"`);
    vmLines.push(`    offer     = "${imageOffer}"`);
    vmLines.push(`    sku       = "${imageSku}"`);
    vmLines.push('    version   = "latest"');
    vmLines.push('  }');

    vmLines.push('');
    vmLines.push('  tags = local.common_tags');
    vmLines.push('}');

    return [
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
  },
};
