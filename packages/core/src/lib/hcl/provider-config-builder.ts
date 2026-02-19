import type { ProviderConfig, ProviderId } from '@terrastudio/types';

/**
 * Builds the terraform.tf and providers.tf file contents
 * from registered provider configurations.
 */
export class ProviderConfigBuilder {
  private providers = new Map<ProviderId, ProviderConfig>();
  private providerUserConfigs = new Map<
    ProviderId,
    Record<string, unknown>
  >();

  addProvider(
    config: ProviderConfig,
    userConfig: Record<string, unknown>,
  ): void {
    this.providers.set(config.id, config);
    this.providerUserConfigs.set(config.id, userConfig);
  }

  /**
   * Generates the terraform.tf content with required_version and required_providers.
   */
  generateTerraformBlock(
    terraformVersion = '>= 1.0',
    backend?: { type: string; config: Record<string, string> },
  ): string {
    const lines: string[] = ['terraform {'];
    lines.push(`  required_version = "${terraformVersion}"`);
    lines.push('');

    if (this.providers.size > 0) {
      lines.push('  required_providers {');
      for (const provider of this.providers.values()) {
        lines.push(provider.generateRequiredProvider());
      }
      lines.push('  }');
    }

    if (backend) {
      lines.push('');
      lines.push(`  backend "${backend.type}" {`);
      for (const [key, value] of Object.entries(backend.config)) {
        lines.push(`    ${key} = "${value}"`);
      }
      lines.push('  }');
    }

    lines.push('}');
    return lines.join('\n');
  }

  /**
   * Generates the providers.tf content with provider blocks.
   */
  generateProviderBlocks(): string {
    const blocks: string[] = [];

    for (const [providerId, config] of this.providers) {
      const userConfig = this.providerUserConfigs.get(providerId) ?? {};
      blocks.push(config.generateProviderBlock(userConfig));
    }

    return blocks.join('\n\n');
  }

  getActiveProviderIds(): ProviderId[] {
    return [...this.providers.keys()];
  }
}
