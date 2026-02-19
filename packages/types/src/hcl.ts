import type { ResourceTypeId } from './resource-schema.js';

export interface ResourceInstance {
  readonly instanceId: string;
  readonly typeId: ResourceTypeId;
  readonly properties: Record<string, unknown>;
  readonly references: Record<string, string>;
  readonly terraformName: string;
}

export interface HclGenerationContext {
  getResource(instanceId: string): ResourceInstance | undefined;
  getTerraformAddress(instanceId: string): string | undefined;
  getAttributeReference(instanceId: string, attribute: string): string;
  addVariable(variable: TerraformVariable): void;
  addOutput(output: TerraformOutput): void;
  getProviderConfig(providerId: string): Record<string, unknown>;
  getResourceGroupExpression(): string;
  getLocationExpression(): string;
}

export interface HclGenerator {
  readonly typeId: ResourceTypeId;
  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[];
}

export interface HclBlock {
  readonly blockType: 'resource' | 'data' | 'locals' | 'variable' | 'output';
  readonly terraformType?: string;
  readonly name?: string;
  readonly content: string;
  readonly dependsOn?: string[];
}

export interface TerraformVariable {
  readonly name: string;
  readonly type: string;
  readonly description: string;
  readonly defaultValue?: unknown;
  readonly sensitive?: boolean;
  readonly validation?: {
    condition: string;
    errorMessage: string;
  };
}

export interface TerraformOutput {
  readonly name: string;
  readonly value: string;
  readonly description: string;
  readonly sensitive?: boolean;
}
