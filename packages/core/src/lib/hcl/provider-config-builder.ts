import type { ProviderConfig, ProviderId } from '@terrastudio/types';

export interface AliasedProviderEntry {
  readonly providerType: string; // e.g. "azurerm"
  readonly alias: string;        // e.g. "sub_prod"
  readonly config: Record<string, unknown>;
}

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
  private aliasedProviders: AliasedProviderEntry[] = [];

  addProvider(
    config: ProviderConfig,
    userConfig: Record<string, unknown>,
  ): void {
    this.providers.set(config.id, config);
    this.providerUserConfigs.set(config.id, userConfig);
  }

  addAliasedProvider(entry: AliasedProviderEntry): void {
    this.aliasedProviders.push(entry);
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
   * Includes both default providers and aliased providers for multi-subscription support.
   */
  generateProviderBlocks(): string {
    const blocks: string[] = [];

    for (const [providerId, config] of this.providers) {
      const userConfig = this.providerUserConfigs.get(providerId) ?? {};
      blocks.push(config.generateProviderBlock(userConfig));
    }

    // Append aliased provider blocks
    for (const entry of this.aliasedProviders) {
      blocks.push(this.generateAliasedBlock(entry));
    }

    return blocks.join('\n\n');
  }

  getActiveProviderIds(): ProviderId[] {
    return [...this.providers.keys()];
  }

  /**
   * Generate an aliased provider block.
   * Uses the registered ProviderConfig's generateProviderBlock as a base,
   * then injects the `alias` line after the opening brace.
   */
  private generateAliasedBlock(entry: AliasedProviderEntry): string {
    const config = this.providers.get(entry.providerType);
    if (config) {
      // Generate the base block and inject alias
      const base = config.generateProviderBlock(entry.config);
      return injectAlias(base, entry.alias);
    }
    // Fallback: manual block generation if provider config not registered
    const lines: string[] = [`provider "${entry.providerType}" {`];
    lines.push(`  alias = "${entry.alias}"`);
    for (const [key, value] of Object.entries(entry.config)) {
      if (typeof value === 'string') {
        lines.push(`  ${key} = "${value}"`);
      } else {
        lines.push(`  ${key} = ${JSON.stringify(value)}`);
      }
    }
    lines.push('}');
    return lines.join('\n');
  }
}

/**
 * Inject `alias = "..."` into a provider block string after the opening `{`.
 */
function injectAlias(block: string, alias: string): string {
  const openBrace = block.indexOf('{');
  if (openBrace === -1) return block;
  return block.slice(0, openBrace + 1) + `\n  alias = "${alias}"` + block.slice(openBrace + 1);
}

/**
 * Sanitize a name into a valid Terraform identifier for use as a provider alias.
 */
export function sanitizeProviderAlias(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^([0-9])/, '_$1')
    .replace(/_+/g, '_')
    .replace(/_$/, '');
}
