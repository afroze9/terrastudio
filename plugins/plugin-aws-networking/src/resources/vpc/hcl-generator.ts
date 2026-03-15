import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext } from '@terrastudio/types';

export const vpcHclGenerator: HclGenerator = {
  typeId: 'aws/networking/vpc',

  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[] {
    const props = resource.properties;
    const name = props['name'] as string;
    const cidrBlock = (props['cidr_block'] as string) ?? '10.0.0.0/16';
    const enableDnsSupport = props['enable_dns_support'] as boolean | undefined;
    const enableDnsHostnames = props['enable_dns_hostnames'] as boolean | undefined;
    const instanceTenancy = props['instance_tenancy'] as string | undefined;

    const nameExpr = context.getPropertyExpression(resource, 'name', name);
    const cidrExpr = context.getPropertyExpression(resource, 'cidr_block', cidrBlock);

    const lines: string[] = [
      `resource "aws_vpc" "${resource.terraformName}" {`,
      `  cidr_block = ${cidrExpr}`,
    ];

    // enable_dns_support defaults to true in AWS, only emit if explicitly set
    const dnsSupportIsVar = resource.variableOverrides?.['enable_dns_support'] === 'variable';
    if (dnsSupportIsVar || enableDnsSupport !== undefined) {
      const dnsSupportExpr = context.getPropertyExpression(resource, 'enable_dns_support', enableDnsSupport ?? true);
      lines.push(`  enable_dns_support = ${dnsSupportExpr}`);
    }

    const dnsHostnamesIsVar = resource.variableOverrides?.['enable_dns_hostnames'] === 'variable';
    if (dnsHostnamesIsVar || (enableDnsHostnames !== undefined && enableDnsHostnames !== false)) {
      const dnsHostnamesExpr = context.getPropertyExpression(resource, 'enable_dns_hostnames', enableDnsHostnames ?? false);
      lines.push(`  enable_dns_hostnames = ${dnsHostnamesExpr}`);
    }

    const tenancyIsVar = resource.variableOverrides?.['instance_tenancy'] === 'variable';
    if (tenancyIsVar || (instanceTenancy !== undefined && instanceTenancy !== 'default')) {
      const tenancyExpr = context.getPropertyExpression(resource, 'instance_tenancy', instanceTenancy ?? 'default');
      lines.push(`  instance_tenancy = ${tenancyExpr}`);
    }

    lines.push('');
    lines.push('  tags = merge(local.common_tags, {');
    lines.push(`    Name = ${nameExpr}`);
    lines.push('  })');
    lines.push('}');

    return [
      {
        blockType: 'resource',
        terraformType: 'aws_vpc',
        name: resource.terraformName,
        content: lines.join('\n'),
      },
    ];
  },
};
