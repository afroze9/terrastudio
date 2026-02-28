import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';
import { escapeHclString as e } from '@terrastudio/core';

export const subnetHclGenerator: HclGenerator = {
  typeId: 'azurerm/networking/subnet',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const addressPrefixes = (props['address_prefixes'] as string[]) ?? ['10.0.1.0/24'];
    const serviceEndpoints = props['service_endpoints'] as string[] | undefined;
    const delegationEnabled = props['delegation_enabled'] as boolean | undefined;
    const delegationService = (props['delegation_service'] as string | undefined) ?? 'Microsoft.Web/serverFarms';

    const rgExpr = context.getResourceGroupExpression(resource);

    // Resolve VNet reference
    const vnetRef = resource.references['virtual_network_name'];
    const vnetNameExpr = vnetRef
      ? context.getAttributeReference(vnetRef, 'name')
      : '"<vnet-name>"';

    const addrList = addressPrefixes.map((a) => `"${e(a)}"`).join(', ');
    const dependsOn: string[] = [];

    if (vnetRef) {
      const vnetAddr = context.getTerraformAddress(vnetRef);
      if (vnetAddr) dependsOn.push(vnetAddr);
    }

    const lines: string[] = [
      `resource "azurerm_subnet" "${resource.terraformName}" {`,
      `  name                 = "${e(name)}"`,
      `  resource_group_name  = ${rgExpr}`,
      `  virtual_network_name = ${vnetNameExpr}`,
      `  address_prefixes     = [${addrList}]`,
    ];

    if (serviceEndpoints && serviceEndpoints.length > 0) {
      const epList = serviceEndpoints.map((ep) => `"${e(ep)}"`).join(', ');
      lines.push(`  service_endpoints    = [${epList}]`);
    }

    if (delegationEnabled) {
      const delegationActionsMap: Record<string, string[]> = {
        'Microsoft.Web/serverFarms': ['Microsoft.Network/virtualNetworks/subnets/action'],
        'Microsoft.ContainerInstance/containerGroups': ['Microsoft.Network/virtualNetworks/subnets/action'],
        'Microsoft.Databricks/workspaces': [
          'Microsoft.Network/virtualNetworks/subnets/join/action',
          'Microsoft.Network/virtualNetworks/subnets/prepareNetworkPolicies/action',
          'Microsoft.Network/virtualNetworks/subnets/unprepareNetworkPolicies/action',
        ],
        'Microsoft.ApiManagement/service': ['Microsoft.Network/virtualNetworks/subnets/join/action'],
      };
      const actions = delegationActionsMap[delegationService] ?? [];
      lines.push('');
      lines.push('  delegation {');
      lines.push('    name = "delegation"');
      lines.push('    service_delegation {');
      lines.push(`      name    = "${e(delegationService)}"`);
      if (actions.length > 0) {
        lines.push(`      actions = [${actions.map((a) => `"${e(a)}"`).join(', ')}]`);
      }
      lines.push('    }');
      lines.push('  }');
    }

    lines.push('}');

    const blocks: HclBlock[] = [
      {
        blockType: 'resource',
        terraformType: 'azurerm_subnet',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];

    // NSG association via reference property
    const nsgRef = resource.references['nsg_id'];
    if (nsgRef) {
      const nsgIdExpr = context.getAttributeReference(nsgRef, 'id');
      const assocDeps = [`azurerm_subnet.${resource.terraformName}`];
      const nsgAddr = context.getTerraformAddress(nsgRef);
      if (nsgAddr) assocDeps.push(nsgAddr);

      const assocLines = [
        `resource "azurerm_subnet_network_security_group_association" "${resource.terraformName}_nsg" {`,
        `  subnet_id                 = azurerm_subnet.${resource.terraformName}.id`,
        `  network_security_group_id = ${nsgIdExpr}`,
        '}',
      ];
      blocks.push({
        blockType: 'resource',
        terraformType: 'azurerm_subnet_network_security_group_association',
        name: `${resource.terraformName}_nsg`,
        content: assocLines.join('\n'),
        dependsOn: assocDeps,
      });
    }

    // Route table association
    const rtRef = resource.references['route_table_id'];
    if (rtRef) {
      const rtIdExpr = context.getAttributeReference(rtRef, 'id');
      const rtAddr = context.getTerraformAddress(rtRef);
      const rtDeps = [`azurerm_subnet.${resource.terraformName}`];
      if (rtAddr) rtDeps.push(rtAddr);

      blocks.push({
        blockType: 'resource',
        terraformType: 'azurerm_subnet_route_table_association',
        name: `${resource.terraformName}_rt`,
        content: [
          `resource "azurerm_subnet_route_table_association" "${resource.terraformName}_rt" {`,
          `  subnet_id      = azurerm_subnet.${resource.terraformName}.id`,
          `  route_table_id = ${rtIdExpr}`,
          `}`,
        ].join('\n'),
        dependsOn: rtDeps,
      });
    }

    // NAT gateway association
    const natRef = resource.references['nat_gateway_id'];
    if (natRef) {
      const natIdExpr = context.getAttributeReference(natRef, 'id');
      const natAddr = context.getTerraformAddress(natRef);
      const natDeps = [`azurerm_subnet.${resource.terraformName}`];
      if (natAddr) natDeps.push(natAddr);

      blocks.push({
        blockType: 'resource',
        terraformType: 'azurerm_subnet_nat_gateway_association',
        name: `${resource.terraformName}_natgw`,
        content: [
          `resource "azurerm_subnet_nat_gateway_association" "${resource.terraformName}_natgw" {`,
          `  subnet_id      = azurerm_subnet.${resource.terraformName}.id`,
          `  nat_gateway_id = ${natIdExpr}`,
          `}`,
        ].join('\n'),
        dependsOn: natDeps,
      });
    }

    return blocks;
  },
};
