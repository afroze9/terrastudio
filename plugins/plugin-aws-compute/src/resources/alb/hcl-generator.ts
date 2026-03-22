import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const albHclGenerator: HclGenerator = {
  typeId: 'aws/compute/alb',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const internal = props['internal'] as boolean ?? false;
    const lbType = (props['load_balancer_type'] as string) ?? 'application';
    const ipAddrType = (props['ip_address_type'] as string) ?? 'ipv4';
    const deletionProtection = props['enable_deletion_protection'] as boolean ?? false;
    const enableHttp2 = props['enable_http2'] as boolean ?? true;
    const enableCrossZone = props['enable_cross_zone_load_balancing'] as boolean ?? false;
    const accessLogsEnabled = props['access_logs_enabled'] as boolean ?? false;
    const accessLogsBucket = props['access_logs_bucket'] as string | undefined;
    const accessLogsPrefix = props['access_logs_prefix'] as string | undefined;

    const dependsOn: string[] = [];

    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const internalExpr = context.getPropertyExpression(resource, 'internal', internal);
    const lbTypeExpr = context.getPropertyExpression(resource, 'load_balancer_type', lbType);
    const ipAddrTypeExpr = context.getPropertyExpression(resource, 'ip_address_type', ipAddrType);
    const deletionProtectionExpr = context.getPropertyExpression(resource, 'enable_deletion_protection', deletionProtection);

    const lines: string[] = [
      `resource "aws_lb" "${resource.terraformName}" {`,
      `  name               = ${nameExpr}`,
      `  internal           = ${internalExpr}`,
      `  load_balancer_type = ${lbTypeExpr}`,
      `  ip_address_type    = ${ipAddrTypeExpr}`,
    ];

    // Security group reference
    const sgRef = resource.references['security_group_ids'];
    if (sgRef) {
      const sgIdExpr = context.getAttributeReference(sgRef, 'id');
      lines.push(`  security_groups    = [${sgIdExpr}]`);
      const sgAddr = context.getTerraformAddress(sgRef);
      if (sgAddr) dependsOn.push(sgAddr);
    }

    // Collect subnet references from edges (connection rule sets subnet_ids / subnet_ids_N)
    const subnetRefs: string[] = [];
    for (const [key, ref] of Object.entries(resource.references)) {
      if (key === 'subnet_ids' || key.startsWith('subnet_ids_')) {
        const subnetIdExpr = context.getAttributeReference(ref, 'id');
        subnetRefs.push(subnetIdExpr);
        const subnetAddr = context.getTerraformAddress(ref);
        if (subnetAddr) dependsOn.push(subnetAddr);
      }
    }
    if (subnetRefs.length > 0) {
      lines.push(`  subnets            = [${subnetRefs.join(', ')}]`);
    }

    lines.push('');
    lines.push(`  enable_deletion_protection = ${deletionProtectionExpr}`);

    // emit enable_http2 only when false (true is the AWS default)
    if (!enableHttp2 || resource.variableOverrides?.['enable_http2'] === 'variable') {
      const http2Expr = context.getPropertyExpression(resource, 'enable_http2', enableHttp2);
      lines.push(`  enable_http2               = ${http2Expr}`);
    }

    // emit enable_cross_zone_load_balancing only when true (false is the AWS default)
    if (enableCrossZone || resource.variableOverrides?.['enable_cross_zone_load_balancing'] === 'variable') {
      const crossZoneExpr = context.getPropertyExpression(resource, 'enable_cross_zone_load_balancing', enableCrossZone);
      lines.push(`  enable_cross_zone_load_balancing = ${crossZoneExpr}`);
    }

    // access_logs block
    if (accessLogsEnabled) {
      lines.push('');
      lines.push('  access_logs {');
      if (accessLogsBucket || resource.variableOverrides?.['access_logs_bucket'] === 'variable') {
        const bucketExpr = context.getPropertyExpression(resource, 'access_logs_bucket', accessLogsBucket ?? '');
        lines.push(`    bucket  = ${bucketExpr}`);
      }
      if (accessLogsPrefix || resource.variableOverrides?.['access_logs_prefix'] === 'variable') {
        const prefixExpr = context.getPropertyExpression(resource, 'access_logs_prefix', accessLogsPrefix ?? '');
        lines.push(`    prefix  = ${prefixExpr}`);
      }
      lines.push('    enabled = true');
      lines.push('  }');
    }

    lines.push('');
    lines.push('  tags = local.common_tags');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'aws_lb',
        name: resource.terraformName,
        content: lines.join('\n'),
        dependsOn,
      },
    ];
  },
};
