import type {
  ResourceInstance,
  HclGenerationContext,
  TerraformVariable,
} from '@terrastudio/types';
import { VariableCollector, OutputCollector } from './variable-collector.js';
import { escapeHclString } from './escape.js';

/**
 * Cross-module reference tracking for module HCL generation.
 * Tracks variables that need to be declared in the module and
 * values that need to be passed from the root module block.
 */
export interface ModuleWiring {
  /** Variables the module declares (inputs from outside) */
  inputVariables: TerraformVariable[];
  /** Outputs the module declares (values consumed from outside) */
  outputDeclarations: Array<{ name: string; value: string; description: string }>;
  /** Values to pass to the module block in root (variable_name → expression) */
  moduleBlockInputs: Map<string, string>;
  /** Mapping of output names for external consumers (output_name → module.X.output_name) */
  moduleBlockOutputs: Map<string, string>;
}

/**
 * A scoped HCL generation context for resources within a module.
 *
 * When a reference crosses the module boundary (target is outside), it:
 * - Replaces the reference with `var.{name}` inside the module
 * - Registers a module input variable
 * - Records the real expression for the root module block
 *
 * When a resource outside references something inside the module, the pipeline
 * handles that by adding outputs to the module.
 */
export class ModuleHclContext implements HclGenerationContext {
  private variableCollector = new VariableCollector();
  private outputCollector = new OutputCollector();

  /** Variables to declare inside the module (cross-boundary inputs) */
  private crossBoundaryInputs = new Map<string, { variable: TerraformVariable; rootExpression: string }>();

  /** Outputs to declare inside the module (consumed by external resources) */
  private crossBoundaryOutputs = new Map<string, { name: string; value: string; description: string }>();

  constructor(
    /** The set of instance IDs belonging to this module */
    private memberInstanceIds: Set<string>,
    /** The full resource map (all resources across all modules and root) */
    private resourceMap: Map<string, ResourceInstance>,
    /** The full address map (instanceId → terraform_type.name) */
    private addressMap: Map<string, string>,
    /** The inner address map (only module-scoped resources) */
    private moduleAddressMap: Map<string, string>,
    /** Project-level provider configs */
    private providerConfigs: Record<string, Record<string, unknown>>,
  ) {}

  getResource(instanceId: string): ResourceInstance | undefined {
    return this.resourceMap.get(instanceId);
  }

  getTerraformAddress(instanceId: string): string | undefined {
    return this.moduleAddressMap.get(instanceId);
  }

  getAttributeReference(instanceId: string, attribute: string): string {
    // If the referenced resource is inside this module, use direct reference
    if (this.memberInstanceIds.has(instanceId)) {
      const addr = this.moduleAddressMap.get(instanceId);
      if (!addr) {
        throw new Error(`Cannot resolve reference to instance "${instanceId}": not found in module`);
      }
      return `${addr}.${attribute}`;
    }

    // Cross-module reference: replace with var.xxx and record for root module block
    const externalAddr = this.addressMap.get(instanceId);
    if (!externalAddr) {
      throw new Error(`Cannot resolve cross-module reference to instance "${instanceId}": not found`);
    }

    const resource = this.resourceMap.get(instanceId);
    const varName = `${resource?.terraformName ?? instanceId}_${attribute}`.replace(/[^a-zA-Z0-9_]/g, '_');

    if (!this.crossBoundaryInputs.has(varName)) {
      this.crossBoundaryInputs.set(varName, {
        variable: {
          name: varName,
          type: 'string',
          description: `${attribute} from ${resource?.terraformName ?? instanceId} (passed from root)`,
        },
        rootExpression: `${externalAddr}.${attribute}`,
      });
    }

    return `var.${varName}`;
  }

  addVariable(variable: TerraformVariable): void {
    this.variableCollector.add(variable);
  }

  addOutput(output: { name: string; value: string; description: string; sensitive?: boolean }): void {
    this.outputCollector.add(output);
  }

  getProviderConfig(providerId: string): Record<string, unknown> {
    return this.providerConfigs[providerId] ?? {};
  }

  getResourceGroupExpression(resource: ResourceInstance): string {
    const rgInstanceId = resource.references['_resource_group'];
    if (!rgInstanceId) {
      throw new Error(
        `Resource "${resource.terraformName}" requires a Resource Group but none was found.`,
      );
    }

    // If the RG is inside this module, use direct reference
    if (this.memberInstanceIds.has(rgInstanceId)) {
      const rgAddr = this.moduleAddressMap.get(rgInstanceId);
      if (rgAddr) return `${rgAddr}.name`;
    }

    // RG is outside: use a module input variable
    const varName = 'resource_group_name';
    const rgAddr = this.addressMap.get(rgInstanceId);
    if (!rgAddr) {
      throw new Error(`Resource Group "${rgInstanceId}" not found in address map.`);
    }

    if (!this.crossBoundaryInputs.has(varName)) {
      this.crossBoundaryInputs.set(varName, {
        variable: {
          name: varName,
          type: 'string',
          description: 'Name of the resource group (passed from root)',
        },
        rootExpression: `${rgAddr}.name`,
      });
    }

    return `var.${varName}`;
  }

  getLocationExpression(resource: ResourceInstance): string {
    const rgInstanceId = resource.references['_resource_group'];
    if (!rgInstanceId) {
      throw new Error(
        `Resource "${resource.terraformName}" requires a location but no Resource Group was found.`,
      );
    }

    // If the RG is inside this module, use direct reference
    if (this.memberInstanceIds.has(rgInstanceId)) {
      const rgAddr = this.moduleAddressMap.get(rgInstanceId);
      if (rgAddr) return `${rgAddr}.location`;
    }

    // RG is outside: use a module input variable
    const varName = 'location';
    const rgAddr = this.addressMap.get(rgInstanceId);
    if (!rgAddr) {
      throw new Error(`Resource Group "${rgInstanceId}" not found in address map.`);
    }

    if (!this.crossBoundaryInputs.has(varName)) {
      this.crossBoundaryInputs.set(varName, {
        variable: {
          name: varName,
          type: 'string',
          description: 'Azure region/location (passed from root)',
        },
        rootExpression: `${rgAddr}.location`,
      });
    }

    return `var.${varName}`;
  }

  getPropertyExpression(
    resource: ResourceInstance,
    propertyKey: string,
    value: unknown,
    options: {
      variableName?: string;
      variableType?: string;
      variableDescription?: string;
      sensitive?: boolean;
    } = {},
  ): string {
    const mode = resource.variableOverrides?.[propertyKey] ?? 'literal';

    if (mode === 'variable') {
      const varName = options.variableName ?? `${resource.terraformName}_${propertyKey}`;
      const varType = options.variableType ??
        (Array.isArray(value) ? 'list(string)' :
        typeof value === 'boolean' ? 'bool' :
        typeof value === 'number' ? 'number' : 'string');
      const varDesc = options.variableDescription ?? `${propertyKey} for ${resource.terraformName}`;

      this.variableCollector.add({
        name: varName,
        type: varType,
        description: varDesc,
        defaultValue: value,
        sensitive: options.sensitive,
      });

      return `var.${varName}`;
    }

    if (Array.isArray(value)) {
      const items = value.map((v) => typeof v === 'string' ? `"${escapeHclString(v)}"` : String(v));
      return `[${items.join(', ')}]`;
    }
    if (typeof value === 'string') return `"${escapeHclString(value)}"`;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (value === null || value === undefined) return 'null';
    return JSON.stringify(value);
  }

  // ── Wiring extraction ──────────────────────────────────────────

  /**
   * Register a module output for an internal resource's attribute.
   * Called by the pipeline when it detects external resources referencing this module's resources.
   */
  addModuleOutput(name: string, value: string, description: string): void {
    if (!this.crossBoundaryOutputs.has(name)) {
      this.crossBoundaryOutputs.set(name, { name, value, description });
    }
  }

  /** Get the variable collector for generating module variables.tf */
  getVariableCollector(): VariableCollector {
    return this.variableCollector;
  }

  /** Get the output collector for generating module outputs.tf */
  getOutputCollector(): OutputCollector {
    return this.outputCollector;
  }

  /** Get the complete wiring information for root module block generation. */
  getWiring(): ModuleWiring {
    // Combine cross-boundary inputs with user-defined variables
    const inputVariables = [
      ...this.crossBoundaryInputs.values(),
    ].map((entry) => entry.variable);

    const moduleBlockInputs = new Map<string, string>();
    for (const [varName, entry] of this.crossBoundaryInputs) {
      moduleBlockInputs.set(varName, entry.rootExpression);
    }

    // Also pass through user-declared variables as module inputs
    for (const v of this.variableCollector.getAll()) {
      if (!moduleBlockInputs.has(v.name)) {
        // User-defined module variable — pass through from root var
        inputVariables.push(v);
        moduleBlockInputs.set(v.name, `var.${v.name}`);
      }
    }

    const outputDeclarations = [...this.crossBoundaryOutputs.values()];

    const moduleBlockOutputs = new Map<string, string>();
    for (const output of outputDeclarations) {
      moduleBlockOutputs.set(output.name, output.value);
    }

    return {
      inputVariables,
      outputDeclarations,
      moduleBlockInputs,
      moduleBlockOutputs,
    };
  }
}
