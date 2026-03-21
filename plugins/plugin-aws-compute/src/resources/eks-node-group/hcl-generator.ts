import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const eksNodeGroupHclGenerator: HclGenerator = {
  typeId: 'aws/containers/eks_node_group',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const instanceType = (props['instance_types'] as string) ?? 't3.medium';
    const desiredSize = Number(props['desired_size'] ?? 2);
    const minSize = Number(props['min_size'] ?? 1);
    const maxSize = Number(props['max_size'] ?? 3);
    const diskSize = Number(props['disk_size'] ?? 20);
    const capacityType = (props['capacity_type'] as string) ?? 'ON_DEMAND';
    const nodeRoleArn = props['node_role_arn'] as string | undefined;
    const subnetIds = props['subnet_ids'] as string[] | undefined;
    const amiType = props['ami_type'] as string | undefined;
    const labels = props['labels'] as Record<string, string> | undefined;

    const nameExpr = context.getPropertyExpression(resource, 'name', name);

    // Get cluster name from parent reference
    const clusterRef = resource.references?.['cluster_name'];
    const clusterNameExpr = clusterRef
      ? context.getAttributeReference(clusterRef, 'name')
      : '"CLUSTER_NAME_PLACEHOLDER"';

    // Node role ARN: use property if set, fall back to reference, then placeholder
    let roleArnExpr: string;
    if (nodeRoleArn || resource.variableOverrides?.['node_role_arn'] === 'variable') {
      roleArnExpr = context.getPropertyExpression(resource, 'node_role_arn', nodeRoleArn ?? '');
    } else {
      const roleRef = resource.references?.['node_role_arn'];
      roleArnExpr = roleRef
        ? context.getAttributeReference(roleRef, 'arn')
        : '"NODE_ROLE_ARN_PLACEHOLDER"';
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

    const lines: string[] = [
      `resource "aws_eks_node_group" "${resource.terraformName}" {`,
      `  cluster_name    = ${clusterNameExpr}`,
      `  node_group_name = ${nameExpr}`,
      `  node_role_arn   = ${roleArnExpr}`,
      `  subnet_ids      = ${subnetIdsExpr}`,
      '',
      `  instance_types  = ["${instanceType}"]`,
      `  capacity_type   = "${capacityType}"`,
      `  disk_size       = ${diskSize}`,
    ];

    // AMI type (only emit when non-default)
    if (amiType && amiType !== 'AL2_x86_64') {
      lines.push(`  ami_type        = "${amiType}"`);
    } else if (resource.variableOverrides?.['ami_type'] === 'variable') {
      const amiTypeExpr = context.getPropertyExpression(resource, 'ami_type', amiType ?? 'AL2_x86_64');
      lines.push(`  ami_type        = ${amiTypeExpr}`);
    }

    lines.push('');
    lines.push('  scaling_config {');
    lines.push(`    desired_size = ${desiredSize}`);
    lines.push(`    min_size     = ${minSize}`);
    lines.push(`    max_size     = ${maxSize}`);
    lines.push('  }');

    // Node labels
    if (labels && Object.keys(labels).length > 0) {
      lines.push('');
      lines.push('  labels = {');
      for (const [k, v] of Object.entries(labels)) {
        lines.push(`    ${k} = "${v}"`);
      }
      lines.push('  }');
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'aws_eks_node_group',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
