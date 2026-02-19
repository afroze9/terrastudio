import type { ProviderConfig } from '@terrastudio/types';

export const azurermProviderConfig: ProviderConfig = {
  id: 'azurerm',
  displayName: 'Azure Resource Manager',
  source: 'hashicorp/azurerm',
  version: '~> 4.0',
  configSchema: [
    {
      key: 'subscription_id',
      label: 'Subscription ID',
      type: 'string',
      required: true,
      description: 'Azure subscription ID',
      placeholder: '00000000-0000-0000-0000-000000000000',
      validation: {
        pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        patternMessage: 'Must be a valid UUID',
      },
    },
  ],
  defaultConfig: {
    subscription_id: '',
  },

  generateProviderBlock(config: Record<string, unknown>): string {
    const lines: string[] = ['provider "azurerm" {'];

    if (config['subscription_id']) {
      lines.push(`  subscription_id = "${config['subscription_id']}"`);
    }

    lines.push('  features {}');
    lines.push('}');
    return lines.join('\n');
  },

  generateRequiredProvider(): string {
    return [
      '    azurerm = {',
      '      source  = "hashicorp/azurerm"',
      '      version = "~> 4.0"',
      '    }',
    ].join('\n');
  },
};
