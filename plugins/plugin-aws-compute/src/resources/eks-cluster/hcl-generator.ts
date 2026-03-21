import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const eksClusterHclGenerator: HclGenerator = {
  typeId: 'aws/containers/eks_cluster',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const k8sVersion = props['kubernetes_version'] as string | undefined;
    const privateAccess = props['endpoint_private_access'] as boolean ?? false;
    const publicAccess = props['endpoint_public_access'] as boolean ?? true;
    const roleArn = props['role_arn'] as string | undefined;
    const subnetIds = props['subnet_ids'] as string[] | undefined;
    const securityGroupIds = props['security_group_ids'] as string[] | undefined;
    const enabledLogTypes = props['enabled_cluster_log_types'] as string[] | undefined;

    const nameExpr = context.getPropertyExpression(resource, 'name', name);

    // Role ARN: use property if set, fall back to reference, then placeholder
    let roleArnExpr: string;
    if (roleArn || resource.variableOverrides?.['role_arn'] === 'variable') {
      roleArnExpr = context.getPropertyExpression(resource, 'role_arn', roleArn ?? '');
    } else {
      const roleRef = resource.references?.['role_arn'];
      roleArnExpr = roleRef
        ? context.getAttributeReference(roleRef, 'arn')
        : '"ROLE_ARN_PLACEHOLDER"';
    }

    // Subnet IDs: use property if set, fall back to reference
    let subnetIdsExpr: string;
    if ((subnetIds && subnetIds.length > 0) || resource.variableOverrides?.['subnet_ids'] === 'variable') {
      subnetIdsExpr = context.getPropertyExpression(resource, 'subnet_ids', subnetIds ?? []);
    } else {
      const subnetRef = resource.references?.['subnet_ids'];
      subnetIdsExpr = subnetRef
        ? context.getAttributeReference(subnetRef, 'id')
        : '[]';
    }

    // Security Group IDs
    let securityGroupIdsExpr: string;
    if ((securityGroupIds && securityGroupIds.length > 0) || resource.variableOverrides?.['security_group_ids'] === 'variable') {
      securityGroupIdsExpr = context.getPropertyExpression(resource, 'security_group_ids', securityGroupIds ?? []);
    } else {
      securityGroupIdsExpr = '[]';
    }

    const lines: string[] = [
      `resource "aws_eks_cluster" "${resource.terraformName}" {`,
      `  name     = ${nameExpr}`,
      `  role_arn = ${roleArnExpr}`,
    ];

    if (k8sVersion) {
      lines.push(`  version  = "${k8sVersion}"`);
    }

    lines.push('');
    lines.push('  vpc_config {');
    lines.push(`    subnet_ids              = ${subnetIdsExpr}`);
    lines.push(`    security_group_ids      = ${securityGroupIdsExpr}`);
    lines.push(`    endpoint_private_access = ${privateAccess}`);
    lines.push(`    endpoint_public_access  = ${publicAccess}`);
    lines.push('  }');

    // Cluster logging
    if (enabledLogTypes && enabledLogTypes.length > 0) {
      const logTypesFormatted = enabledLogTypes.map(t => `"${t}"`).join(', ');
      lines.push('');
      lines.push(`  enabled_cluster_log_types = [${logTypesFormatted}]`);
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'aws_eks_cluster',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
