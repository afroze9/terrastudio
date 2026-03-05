import type { ProviderConfig } from '@terrastudio/types';

export const awsProviderConfig: ProviderConfig = {
  id: 'aws',
  displayName: 'Amazon Web Services',
  source: 'hashicorp/aws',
  version: '~> 5.0',
  configSchema: [
    {
      key: 'region',
      label: 'Region',
      type: 'select',
      required: true,
      description: 'AWS region to deploy resources in',
      options: [
        { label: 'US East (N. Virginia) - us-east-1', value: 'us-east-1' },
        { label: 'US East (Ohio) - us-east-2', value: 'us-east-2' },
        { label: 'US West (N. California) - us-west-1', value: 'us-west-1' },
        { label: 'US West (Oregon) - us-west-2', value: 'us-west-2' },
        { label: 'Europe (Ireland) - eu-west-1', value: 'eu-west-1' },
        { label: 'Europe (London) - eu-west-2', value: 'eu-west-2' },
        { label: 'Europe (Frankfurt) - eu-central-1', value: 'eu-central-1' },
        { label: 'Asia Pacific (Singapore) - ap-southeast-1', value: 'ap-southeast-1' },
        { label: 'Asia Pacific (Sydney) - ap-southeast-2', value: 'ap-southeast-2' },
        { label: 'Asia Pacific (Tokyo) - ap-northeast-1', value: 'ap-northeast-1' },
        { label: 'Asia Pacific (Mumbai) - ap-south-1', value: 'ap-south-1' },
        { label: 'Canada (Central) - ca-central-1', value: 'ca-central-1' },
        { label: 'South America (Sao Paulo) - sa-east-1', value: 'sa-east-1' },
      ],
    },
    {
      key: 'profile',
      label: 'Profile',
      type: 'string',
      required: false,
      description: 'AWS CLI profile name (optional)',
      placeholder: 'default',
    },
  ],
  defaultConfig: {
    region: 'us-east-1',
  },

  generateProviderBlock(config: Record<string, unknown>): string {
    const lines: string[] = ['provider "aws" {'];

    const region = (config['region'] as string | undefined) ?? 'us-east-1';
    if (region.startsWith('var.')) {
      lines.push(`  region = ${region}`);
    } else {
      lines.push(`  region = "${region}"`);
    }

    const profile = config['profile'] as string | undefined;
    if (profile) {
      if (profile.startsWith('var.')) {
        lines.push(`  profile = ${profile}`);
      } else {
        lines.push(`  profile = "${profile}"`);
      }
    }

    lines.push('}');
    return lines.join('\n');
  },

  generateRequiredProvider(): string {
    return [
      '    aws = {',
      '      source  = "hashicorp/aws"',
      '      version = "~> 5.0"',
      '    }',
    ].join('\n');
  },
};
