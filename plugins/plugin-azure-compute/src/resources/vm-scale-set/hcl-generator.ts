import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

const e = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

export const vmScaleSetHclGenerator: HclGenerator = {
  typeId: 'azurerm/compute/virtual_machine_scale_set',

  resolveTerraformType(properties: Record<string, unknown>): string {
    return (properties['os_type'] as string ?? '').toLowerCase() === 'windows'
      ? 'azurerm_windows_virtual_machine_scale_set'
      : 'azurerm_linux_virtual_machine_scale_set';
  },

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const osType = ((props['os_type'] as string) ?? 'linux').toLowerCase();
    const sku = (props['sku'] as string) ?? 'Standard_B2s';
    const instances = props['instances'] as number ?? 2;
    const adminUsername = (props['admin_username'] as string) ?? 'azureuser';
    const imagePublisher = (props['image_publisher'] as string) ?? 'Canonical';
    const imageOffer = (props['image_offer'] as string) ?? '0001-com-ubuntu-server-jammy';
    const imageSku = (props['image_sku'] as string) ?? '22_04-lts';
    const osDiskSizeGb = props['os_disk_size_gb'] as number | undefined;
    const osDiskType = (props['os_disk_type'] as string) ?? 'Standard_LRS';
    const upgradeMode = (props['upgrade_mode'] as string) ?? 'Manual';
    const singlePlacementGroup = props['single_placement_group'] as boolean | undefined;
    const overprovision = props['overprovision'] as boolean | undefined;
    const zones = props['zones'] as string[] | undefined;
    const identityEnabled = props['identity_enabled'] as boolean | undefined;
    const identityType = (props['identity_type'] as string) ?? 'SystemAssigned';
    const priority = (props['priority'] as string) ?? 'Regular';
    const evictionPolicy = props['eviction_policy'] as string | undefined;
    const maxBidPrice = props['max_bid_price'] as number | undefined;
    const encryptionAtHostEnabled = props['encryption_at_host_enabled'] as boolean | undefined;

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);
    const dependsOn: string[] = [];

    const terraformType = osType === 'windows'
      ? 'azurerm_windows_virtual_machine_scale_set'
      : 'azurerm_linux_virtual_machine_scale_set';

    // Resolve subnet reference for inline NIC
    const subnetRef = resource.references['subnet_id'];
    const subnetIdExpr = subnetRef
      ? context.getAttributeReference(subnetRef, 'id')
      : '"<subnet-id>"';
    if (subnetRef) {
      const subnetAddr = context.getTerraformAddress(subnetRef);
      if (subnetAddr) dependsOn.push(subnetAddr);
    }

    // Resolve LB backend pool reference
    const lbRef = resource.references['lb_backend_pool_id'];
    let lbBackendPoolExpr: string | undefined;
    if (lbRef) {
      lbBackendPoolExpr = context.getAttributeReference(lbRef, 'id');
      const lbAddr = context.getTerraformAddress(lbRef);
      if (lbAddr) dependsOn.push(lbAddr);
    }

    const lines: string[] = [
      `resource "${terraformType}" "${resource.terraformName}" {`,
      `  name                = ${context.getPropertyExpression(resource, 'name', name)}`,
      `  resource_group_name = ${rgExpr}`,
      `  location            = ${locExpr}`,
      `  sku                 = ${context.getPropertyExpression(resource, 'sku', sku)}`,
      `  instances           = ${context.getPropertyExpression(resource, 'instances', instances)}`,
      `  admin_username      = ${context.getPropertyExpression(resource, 'admin_username', adminUsername)}`,
    ];

    // OS-specific auth
    if (osType === 'windows') {
      const passwordVarName = `${resource.terraformName}_admin_password`;
      context.addVariable({
        name: passwordVarName,
        type: 'string',
        description: `Admin password for Windows VMSS ${name}`,
        sensitive: true,
      });
      lines.push(`  admin_password      = var.${passwordVarName}`);
    } else {
      const sshKeyVarName = `${resource.terraformName}_ssh_public_key`;
      context.addVariable({
        name: sshKeyVarName,
        type: 'string',
        description: `SSH public key for Linux VMSS ${name}`,
        sensitive: false,
      });
      lines.push('');
      lines.push('  admin_ssh_key {');
      lines.push(`    username   = ${context.getPropertyExpression(resource, 'admin_username', adminUsername)}`);
      lines.push(`    public_key = var.${sshKeyVarName}`);
      lines.push('  }');
      lines.push('');
      lines.push('  disable_password_authentication = true');
    }

    // Upgrade mode
    if (upgradeMode !== 'Manual' || resource.variableOverrides?.['upgrade_mode'] === 'variable') {
      lines.push(`  upgrade_mode        = ${context.getPropertyExpression(resource, 'upgrade_mode', upgradeMode)}`);
    }

    // Overprovision (default true, emit only if false)
    if (overprovision === false || resource.variableOverrides?.['overprovision'] === 'variable') {
      lines.push(`  overprovision       = ${context.getPropertyExpression(resource, 'overprovision', overprovision ?? true)}`);
    }

    // Single placement group (default true, emit only if false)
    if (singlePlacementGroup === false || resource.variableOverrides?.['single_placement_group'] === 'variable') {
      lines.push(`  single_placement_group = ${context.getPropertyExpression(resource, 'single_placement_group', singlePlacementGroup ?? true)}`);
    }

    // Spot VM priority
    if (priority === 'Spot' || resource.variableOverrides?.['priority'] === 'variable') {
      lines.push(`  priority              = ${context.getPropertyExpression(resource, 'priority', priority)}`);
      if (evictionPolicy || resource.variableOverrides?.['eviction_policy'] === 'variable') {
        lines.push(`  eviction_policy       = ${context.getPropertyExpression(resource, 'eviction_policy', evictionPolicy ?? 'Deallocate')}`);
      }
      if (maxBidPrice !== undefined || resource.variableOverrides?.['max_bid_price'] === 'variable') {
        lines.push(`  max_bid_price         = ${context.getPropertyExpression(resource, 'max_bid_price', maxBidPrice ?? -1)}`);
      }
    }

    // Encryption at host
    if (encryptionAtHostEnabled === true || resource.variableOverrides?.['encryption_at_host_enabled'] === 'variable') {
      lines.push(`  encryption_at_host_enabled = ${context.getPropertyExpression(resource, 'encryption_at_host_enabled', encryptionAtHostEnabled ?? false)}`);
    }

    // Zones
    if (zones && zones.length > 0) {
      const zoneList = zones.map(z => `"${e(z)}"`).join(', ');
      lines.push(`  zones               = [${zoneList}]`);
    }

    // OS disk
    lines.push('', '  os_disk {');
    lines.push('    caching              = "ReadWrite"');
    lines.push(`    storage_account_type = ${context.getPropertyExpression(resource, 'os_disk_type', osDiskType)}`);
    if (osDiskSizeGb) {
      lines.push(`    disk_size_gb         = ${context.getPropertyExpression(resource, 'os_disk_size_gb', osDiskSizeGb)}`);
    }
    lines.push('  }');

    // Source image reference
    lines.push('', '  source_image_reference {');
    lines.push(`    publisher = ${context.getPropertyExpression(resource, 'image_publisher', imagePublisher)}`);
    lines.push(`    offer     = ${context.getPropertyExpression(resource, 'image_offer', imageOffer)}`);
    lines.push(`    sku       = ${context.getPropertyExpression(resource, 'image_sku', imageSku)}`);
    lines.push('    version   = "latest"');
    lines.push('  }');

    // Inline network interface
    lines.push('', '  network_interface {');
    lines.push(`    name    = "${e(name)}-nic"`);
    lines.push('    primary = true');
    lines.push('');
    lines.push('    ip_configuration {');
    lines.push('      name      = "internal"');
    lines.push('      primary   = true');
    lines.push(`      subnet_id = ${subnetIdExpr}`);
    if (lbBackendPoolExpr) {
      lines.push(`      load_balancer_backend_address_pool_ids = [${lbBackendPoolExpr}]`);
    }
    lines.push('    }');
    lines.push('  }');

    // Identity
    if (identityEnabled || resource.variableOverrides?.['identity_enabled'] === 'variable') {
      lines.push('');
      lines.push('  identity {');
      lines.push(`    type = ${context.getPropertyExpression(resource, 'identity_type', identityType)}`);
      lines.push('  }');
    }

    lines.push('', '  tags = local.common_tags', '}');

    return [{
      blockType: 'resource',
      terraformType,
      name: resource.terraformName,
      content: lines.join('\n'),
      dependsOn: dependsOn.length > 0 ? dependsOn : undefined,
    }];
  },
};
