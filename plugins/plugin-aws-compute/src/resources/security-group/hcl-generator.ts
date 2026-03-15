import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';
import { escapeHclString as e } from '@terrastudio/core';

interface SecurityGroupRule {
  description?: string;
  from_port?: number;
  to_port?: number;
  protocol?: string;
  cidr_blocks?: string[];
}

export const securityGroupHclGenerator: HclGenerator = {
  typeId: 'aws/compute/security_group',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const description = (props['description'] as string) ?? 'Managed by TerraStudio';
    const ingressRules = (props['ingress_rules'] as SecurityGroupRule[]) ?? [];
    const egressRules = (props['egress_rules'] as SecurityGroupRule[]) ?? [];

    const dependsOn: string[] = [];

    // Resolve VPC reference from parent containment
    const vpcRef = resource.references['vpc_id'];
    const vpcIdExpr = vpcRef
      ? context.getAttributeReference(vpcRef, 'id')
      : '"<vpc-id>"';

    if (vpcRef) {
      const vpcAddr = context.getTerraformAddress(vpcRef);
      if (vpcAddr) dependsOn.push(vpcAddr);
    }

    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const descExpr = context.getPropertyExpression(resource, 'description', description);

    const lines: string[] = [
      `resource "aws_security_group" "${resource.terraformName}" {`,
      `  name        = ${nameExpr}`,
      `  description = ${descExpr}`,
      `  vpc_id      = ${vpcIdExpr}`,
    ];

    // Emit ingress blocks
    for (const rule of ingressRules) {
      lines.push('');
      lines.push('  ingress {');
      if (rule.description) {
        lines.push(`    description = "${e(rule.description)}"`);
      }
      lines.push(`    from_port   = ${rule.from_port ?? 0}`);
      lines.push(`    to_port     = ${rule.to_port ?? 0}`);
      lines.push(`    protocol    = "${e(rule.protocol ?? 'tcp')}"`);
      if (rule.cidr_blocks && rule.cidr_blocks.length > 0) {
        const cidrs = rule.cidr_blocks.map((c) => `"${e(c)}"`).join(', ');
        lines.push(`    cidr_blocks = [${cidrs}]`);
      }
      lines.push('  }');
    }

    // Emit egress blocks
    for (const rule of egressRules) {
      lines.push('');
      lines.push('  egress {');
      if (rule.description) {
        lines.push(`    description = "${e(rule.description)}"`);
      }
      lines.push(`    from_port   = ${rule.from_port ?? 0}`);
      lines.push(`    to_port     = ${rule.to_port ?? 0}`);
      lines.push(`    protocol    = "${e(rule.protocol ?? '-1')}"`);
      if (rule.cidr_blocks && rule.cidr_blocks.length > 0) {
        const cidrs = rule.cidr_blocks.map((c) => `"${e(c)}"`).join(', ');
        lines.push(`    cidr_blocks = [${cidrs}]`);
      }
      lines.push('  }');
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'aws_security_group',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
