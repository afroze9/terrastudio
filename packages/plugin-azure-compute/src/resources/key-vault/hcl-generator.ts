import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext, AccessModel, AccessGrant } from '@terrastudio/types';
import { escapeHclString as e } from '@terrastudio/core';

function getPrincipalExpression(grant: AccessGrant, context: HclGenerationContext): string {
  switch (grant.identity_type) {
    case 'current_user':
      return 'data.azurerm_client_config.current.object_id';
    case 'managed_identity':
      if (grant.identity_ref) {
        return context.getAttributeReference(grant.identity_ref, 'principal_id');
      }
      return '"<principal-id>"';
    case 'custom':
      return `"${e(grant.custom_principal_id ?? '')}"`;
    default:
      return '"<principal-id>"';
  }
}

function generateRoleAssignment(
  kvResource: ResourceInstance,
  grant: AccessGrant,
  index: number,
  context: HclGenerationContext
): HclBlock | null {
  if (!grant.role) return null;

  const principalExpr = getPrincipalExpression(grant, context);
  const tfName = `${kvResource.terraformName}_access_${index}`;

  const lines = [
    `resource "azurerm_role_assignment" "${tfName}" {`,
    `  scope                = azurerm_key_vault.${kvResource.terraformName}.id`,
    `  role_definition_name = "${e(grant.role)}"`,
    `  principal_id         = ${principalExpr}`,
    '}',
  ];

  const dependsOn: string[] = [`azurerm_key_vault.${kvResource.terraformName}`];
  if (grant.identity_type === 'managed_identity' && grant.identity_ref) {
    const addr = context.getTerraformAddress(grant.identity_ref);
    if (addr) dependsOn.push(addr);
  }

  return {
    blockType: 'resource',
    terraformType: 'azurerm_role_assignment',
    name: tfName,
    content: lines.join('\n'),
    dependsOn,
  };
}

export const keyVaultHclGenerator: HclGenerator = {
  typeId: 'azurerm/security/key_vault',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const skuName = (props['sku_name'] as string) ?? 'standard';
    const softDeleteDays = props['soft_delete_retention_days'] as number | undefined;
    const purgeProtection = props['purge_protection_enabled'] as boolean | undefined;
    const forDeployment = props['enabled_for_deployment'] as boolean | undefined;
    const forDiskEncryption = props['enabled_for_disk_encryption'] as boolean | undefined;
    const forTemplateDeployment = props['enabled_for_template_deployment'] as boolean | undefined;

    const accessModel = (props['access_model'] as AccessModel) ?? 'rbac';
    const accessGrants = (props['access_grants'] as AccessGrant[]) ?? [];

    const rgExpr = context.getResourceGroupExpression(resource);
    const locExpr = context.getLocationExpression(resource);

    const lines: string[] = [
      `resource "azurerm_key_vault" "${resource.terraformName}" {`,
      `  name                = "${e(name)}"`,
      `  resource_group_name = ${rgExpr}`,
      `  location            = ${locExpr}`,
      `  sku_name            = "${e(skuName)}"`,
      '  tenant_id           = data.azurerm_client_config.current.tenant_id',
    ];

    // Enable RBAC authorization when using RBAC access model
    if (accessModel === 'rbac') {
      lines.push('  enable_rbac_authorization = true');
    }

    if (softDeleteDays != null && softDeleteDays !== 90) {
      lines.push(`  soft_delete_retention_days = ${softDeleteDays}`);
    }

    if (purgeProtection) {
      lines.push('  purge_protection_enabled  = true');
    }

    if (forDeployment) {
      lines.push('  enabled_for_deployment = true');
    }

    if (forDiskEncryption) {
      lines.push('  enabled_for_disk_encryption = true');
    }

    if (forTemplateDeployment) {
      lines.push('  enabled_for_template_deployment = true');
    }

    // For Access Policy mode: embed access_policy blocks inside the Key Vault
    if (accessModel === 'access_policy' && accessGrants.length > 0) {
      for (const grant of accessGrants) {
        const principalExpr = getPrincipalExpression(grant, context);
        lines.push('');
        lines.push('  access_policy {');
        lines.push('    tenant_id = data.azurerm_client_config.current.tenant_id');
        lines.push(`    object_id = ${principalExpr}`);
        if (grant.key_permissions && grant.key_permissions.length > 0) {
          const perms = grant.key_permissions.map(p => `"${e(p)}"`).join(', ');
          lines.push(`    key_permissions = [${perms}]`);
        }
        if (grant.secret_permissions && grant.secret_permissions.length > 0) {
          const perms = grant.secret_permissions.map(p => `"${e(p)}"`).join(', ');
          lines.push(`    secret_permissions = [${perms}]`);
        }
        if (grant.certificate_permissions && grant.certificate_permissions.length > 0) {
          const perms = grant.certificate_permissions.map(p => `"${e(p)}"`).join(', ');
          lines.push(`    certificate_permissions = [${perms}]`);
        }
        lines.push('  }');
      }
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    // Also generate the data source for current client config
    const dataLines = [
      'data "azurerm_client_config" "current" {}',
    ];

    const blocks: HclBlock[] = [
      {
        blockType: 'data',
        terraformType: 'azurerm_client_config',
        name: 'current',
        content: dataLines.join('\n'),
      },
      {
        blockType: 'resource',
        terraformType: 'azurerm_key_vault',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];

    // For RBAC mode: generate separate role assignment resources
    if (accessModel === 'rbac' && accessGrants.length > 0) {
      accessGrants.forEach((grant, index) => {
        const roleBlock = generateRoleAssignment(resource, grant, index, context);
        if (roleBlock) blocks.push(roleBlock);
      });
    }

    return blocks;
  },
};
