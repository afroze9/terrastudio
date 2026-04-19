import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';
import { escapeHclString as e } from '@terrastudio/core';

export const vnetPeeringHclGenerator: HclGenerator = {
  typeId: 'azurerm/networking/virtual_network_peering',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const prefix = (props['name_prefix'] as string) ?? resource.terraformName;
    const allowAccess = (props['allow_virtual_network_access'] as boolean | undefined) ?? true;
    const allowForwarded = (props['allow_forwarded_traffic'] as boolean | undefined) ?? false;
    const allowGateway = (props['allow_gateway_transit'] as boolean | undefined) ?? false;
    const useRemote = (props['use_remote_gateways'] as boolean | undefined) ?? false;

    const aRef = resource.references['vnet_a_id'];
    const bRef = resource.references['vnet_b_id'];

    if (!aRef || !bRef) {
      return [];
    }

    const aNameExpr = context.getAttributeReference(aRef, 'name');
    const aIdExpr = context.getAttributeReference(aRef, 'id');
    const aRgExpr = context.getAttributeReference(aRef, 'resource_group_name');
    const bNameExpr = context.getAttributeReference(bRef, 'name');
    const bIdExpr = context.getAttributeReference(bRef, 'id');
    const bRgExpr = context.getAttributeReference(bRef, 'resource_group_name');

    const aAddr = context.getTerraformAddress(aRef);
    const bAddr = context.getTerraformAddress(bRef);
    const dependsOn = [aAddr, bAddr].filter(Boolean) as string[];

    const aToBName = `${prefix}-a-to-b`;
    const bToAName = `${prefix}-b-to-a`;

    const peeringBlock = (tfName: string, srcVnetNameExpr: string, srcRgExpr: string, remoteIdExpr: string, gatewayTransit: boolean, useRemoteGw: boolean): string[] => [
      `resource "azurerm_virtual_network_peering" "${tfName}" {`,
      `  name                         = "${e(tfName)}"`,
      `  resource_group_name          = ${srcRgExpr}`,
      `  virtual_network_name         = ${srcVnetNameExpr}`,
      `  remote_virtual_network_id    = ${remoteIdExpr}`,
      `  allow_virtual_network_access = ${allowAccess}`,
      `  allow_forwarded_traffic      = ${allowForwarded}`,
      `  allow_gateway_transit        = ${gatewayTransit}`,
      `  use_remote_gateways          = ${useRemoteGw}`,
      `}`,
    ];

    const aToBContent = peeringBlock(
      `${resource.terraformName}_a_to_b`,
      aNameExpr,
      aRgExpr,
      bIdExpr,
      allowGateway,
      useRemote,
    ).join('\n');

    // On the B side, swap gateway_transit and use_remote_gateways — Azure's model is asymmetric
    const bToAContent = peeringBlock(
      `${resource.terraformName}_b_to_a`,
      bNameExpr,
      bRgExpr,
      aIdExpr,
      useRemote,
      allowGateway,
    ).join('\n');

    // Suppress unused-variable warning (name used inside quoted strings above)
    void aToBName;
    void bToAName;

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_virtual_network_peering',
        name: `${resource.terraformName}_a_to_b`,
        content: aToBContent,
        dependsOn,
      },
      {
        blockType: 'resource',
        terraformType: 'azurerm_virtual_network_peering',
        name: `${resource.terraformName}_b_to_a`,
        content: bToAContent,
        dependsOn,
      },
    ];
  },
};
