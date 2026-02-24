import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const vnetIntegrationHclGenerator: HclGenerator = {
  typeId: 'azurerm/networking/vnet_integration',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const dependsOn: string[] = [];

    // subnet_id is derived from parentId via parentReference
    const subnetRef = resource.references['subnet_id'];
    const subnetIdExpr = subnetRef
      ? context.getAttributeReference(subnetRef, 'id')
      : '"<subnet-id>"';
    if (subnetRef) {
      const addr = context.getTerraformAddress(subnetRef);
      if (addr) dependsOn.push(addr);
    }

    const appRef = resource.references['app_service_id'];
    const appIdExpr = appRef
      ? context.getAttributeReference(appRef, 'id')
      : '"<app-service-id>"';
    if (appRef) {
      const addr = context.getTerraformAddress(appRef);
      if (addr) dependsOn.push(addr);
    }

    const lines = [
      `resource "azurerm_app_service_virtual_network_swift_connection" "${resource.terraformName}" {`,
      `  app_service_id = ${appIdExpr}`,
      `  subnet_id      = ${subnetIdExpr}`,
      `}`,
    ];

    return [
      {
        blockType: 'resource',
        terraformType: 'azurerm_app_service_virtual_network_swift_connection',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
