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

    const nameExpr = context.getPropertyExpression(resource, 'name', name);

    // Get cluster name from parent reference
    const clusterRef = resource.references?.['cluster_name'];
    const clusterNameExpr = clusterRef
      ? context.getAttributeReference(clusterRef, 'name')
      : '"CLUSTER_NAME_PLACEHOLDER"';

    // Node role reference
    const roleRef = resource.references?.['node_role_arn'];
    const roleArnExpr = roleRef
      ? context.getAttributeReference(roleRef, 'arn')
      : '"NODE_ROLE_ARN_PLACEHOLDER"';

    // Subnet IDs reference
    const subnetRef = resource.references?.['subnet_ids'];
    const subnetIdsExpr = subnetRef
      ? context.getAttributeReference(subnetRef, 'id')
      : '[]';

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
      '',
      '  scaling_config {',
      `    desired_size = ${desiredSize}`,
      `    min_size     = ${minSize}`,
      `    max_size     = ${maxSize}`,
      '  }',
      '',
      '  tags = local.common_tags',
      '}',
    ];

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
