import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const ec2InstanceHclGenerator: HclGenerator = {
  typeId: 'aws/compute/instance',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const ami = props['ami'] as string;
    const instanceType = (props['instance_type'] as string) ?? 't3.micro';
    const keyName = props['key_name'] as string | undefined;
    const associatePublicIp = props['associate_public_ip_address'] as boolean ?? false;
    const rootSize = props['root_block_device_size'] as number ?? 8;
    const rootType = (props['root_block_device_type'] as string) ?? 'gp3';

    const dependsOn: string[] = [];

    // Resolve subnet reference from parent containment
    const subnetRef = resource.references['subnet_id'];
    const subnetIdExpr = subnetRef
      ? context.getAttributeReference(subnetRef, 'id')
      : '"<subnet-id>"';

    if (subnetRef) {
      const subnetAddr = context.getTerraformAddress(subnetRef);
      if (subnetAddr) dependsOn.push(subnetAddr);
    }

    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const amiExpr = context.getPropertyExpression(resource, 'ami', ami);
    const instanceTypeExpr = context.getPropertyExpression(resource, 'instance_type', instanceType);
    const associatePublicIpExpr = context.getPropertyExpression(resource, 'associate_public_ip_address', associatePublicIp);
    const rootSizeExpr = context.getPropertyExpression(resource, 'root_block_device_size', rootSize);
    const rootTypeExpr = context.getPropertyExpression(resource, 'root_block_device_type', rootType);

    const lines: string[] = [
      `resource "aws_instance" "${resource.terraformName}" {`,
      `  ami                         = ${amiExpr}`,
      `  instance_type               = ${instanceTypeExpr}`,
      `  subnet_id                   = ${subnetIdExpr}`,
      `  associate_public_ip_address = ${associatePublicIpExpr}`,
    ];

    // Key pair
    if (keyName || resource.variableOverrides?.['key_name'] === 'variable') {
      const keyNameExpr = context.getPropertyExpression(resource, 'key_name', keyName ?? '');
      lines.push(`  key_name                    = ${keyNameExpr}`);
    }

    // Security group reference
    const sgRef = resource.references['security_group_ids'];
    if (sgRef) {
      const sgIdExpr = context.getAttributeReference(sgRef, 'id');
      lines.push(`  vpc_security_group_ids      = [${sgIdExpr}]`);
      const sgAddr = context.getTerraformAddress(sgRef);
      if (sgAddr) dependsOn.push(sgAddr);
    }

    lines.push('');
    lines.push('  root_block_device {');
    lines.push(`    volume_size = ${rootSizeExpr}`);
    lines.push(`    volume_type = ${rootTypeExpr}`);
    lines.push('  }');

    lines.push('');
    lines.push('  tags = merge(local.common_tags, {');
    lines.push(`    Name = ${nameExpr}`);
    lines.push('  })');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'aws_instance',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
