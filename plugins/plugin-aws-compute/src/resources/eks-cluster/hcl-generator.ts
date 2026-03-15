import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const eksClusterHclGenerator: HclGenerator = {
  typeId: 'aws/containers/eks_cluster',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const k8sVersion = props['kubernetes_version'] as string | undefined;
    const privateAccess = props['endpoint_private_access'] as boolean ?? false;
    const publicAccess = props['endpoint_public_access'] as boolean ?? true;

    const nameExpr = context.getPropertyExpression(resource, 'name', name);

    const roleRef = resource.references?.['role_arn'];
    const roleArnExpr = roleRef
      ? context.getAttributeReference(roleRef, 'arn')
      : '"ROLE_ARN_PLACEHOLDER"';

    const subnetRef = resource.references?.['subnet_ids'];
    const subnetIdsExpr = subnetRef
      ? context.getAttributeReference(subnetRef, 'id')
      : '[]';

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
    lines.push(`    endpoint_private_access = ${privateAccess}`);
    lines.push(`    endpoint_public_access  = ${publicAccess}`);
    lines.push('  }');

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
