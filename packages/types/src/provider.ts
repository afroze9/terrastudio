import type { PropertySchema } from './resource-schema.js';

/** Terraform provider identifier, e.g., 'azurerm', 'aws', 'google' */
export type ProviderId = string;

/** Defines a Terraform provider. One plugin per provider should register this. */
export interface ProviderConfig {
  readonly id: ProviderId;
  readonly displayName: string;
  readonly source: string;
  readonly version: string;
  readonly configSchema: PropertySchema[];
  readonly defaultConfig: Record<string, unknown>;

  generateProviderBlock(config: Record<string, unknown>): string;
  generateRequiredProvider(): string;
}
