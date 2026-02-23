import type { ResourceTypeId } from './resource-schema.js';
import type { PropertyVariableMode } from './node.js';

export interface ResourceInstance {
  readonly instanceId: string;
  readonly typeId: ResourceTypeId;
  readonly properties: Record<string, unknown>;
  readonly references: Record<string, string>;
  readonly terraformName: string;
  /** Per-property override for literal vs variable mode */
  readonly variableOverrides?: Record<string, PropertyVariableMode>;
}

export interface HclGenerationContext {
  getResource(instanceId: string): ResourceInstance | undefined;
  getTerraformAddress(instanceId: string): string | undefined;
  getAttributeReference(instanceId: string, attribute: string): string;
  addVariable(variable: TerraformVariable): void;
  addOutput(output: TerraformOutput): void;
  getProviderConfig(providerId: string): Record<string, unknown>;
  /**
   * Get the resource group name expression for a resource.
   * Resolves to the parent Resource Group's .name attribute via _resource_group reference.
   */
  getResourceGroupExpression(resource: ResourceInstance): string;
  /**
   * Get the location expression for a resource.
   * Resolves to the parent Resource Group's .location attribute via _resource_group reference.
   */
  getLocationExpression(resource: ResourceInstance): string;
  /**
   * Get the HCL expression for a property value, respecting variable overrides.
   * If property is set to 'variable' mode, registers a variable and returns var.xxx.
   * Otherwise returns the literal value as HCL string.
   */
  getPropertyExpression(
    resource: ResourceInstance,
    propertyKey: string,
    value: unknown,
    options?: {
      variableName?: string;
      variableType?: string;
      variableDescription?: string;
      sensitive?: boolean;
    },
  ): string;
}

export interface HclGenerator {
  readonly typeId: ResourceTypeId;
  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[];
  /** Resolve the actual Terraform type based on properties (for OS-variant resources like VM, App Service). Falls back to schema.terraformType if not implemented. */
  resolveTerraformType?(properties: Record<string, unknown>): string;
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

export interface OutputBinding {
  readonly sourceInstanceId: string;
  readonly targetInstanceId: string;
  readonly sourceAttribute: string;
}

export interface BindingHclGenerator {
  readonly sourceType?: ResourceTypeId;
  readonly targetType: ResourceTypeId;
  generate(
    source: ResourceInstance,
    target: ResourceInstance,
    context: HclGenerationContext,
    sourceAttribute: string,
  ): HclBlock[];
}
