import type {
  ResourceInstance,
  HclBlock,
  HclGenerationContext,
  TerraformVariable,
  TerraformOutput,
  OutputBinding,
  ProviderId,
  NamingConvention,
  ProjectEdgeStyles,
  ModuleDefinition,
  ModuleInstance,
} from '@terrastudio/types';
import type { PluginRegistry } from '../registry/plugin-registry.js';
import { DependencyGraph } from './dependency-graph.js';
import { VariableCollector, OutputCollector } from './variable-collector.js';
import { ProviderConfigBuilder } from './provider-config-builder.js';
import { HclBlockBuilder, type GeneratedFiles } from './block-builder.js';
import { ModuleHclContext } from './module-context.js';
import { escapeHclString } from './escape.js';

export type LayoutAlgorithm = 'dagre' | 'hybrid';

export interface ProjectConfig {
  providerConfigs: Record<ProviderId, Record<string, unknown>>;
  commonTags: Record<string, string>;
  variableValues: Record<string, string>;
  layoutAlgorithm?: LayoutAlgorithm;
  namingConvention?: NamingConvention;
  backend?: {
    type: string;
    config: Record<string, string>;
  };
  /** Project-level edge style defaults per category */
  edgeStyles?: ProjectEdgeStyles;
  /** Which cloud providers this project targets. undefined = ['azurerm'] for backward compat. */
  activeProviders?: ProviderId[];
  /** Stable ID linking this project to its user secrets store (sensitive variable values). */
  secretsId?: string;
}

export interface PipelineInput {
  resources: ResourceInstance[];
  projectConfig: ProjectConfig;
  bindings?: OutputBinding[];
  /** Module definitions for module-aware HCL generation */
  modules?: ModuleDefinition[];
  /** Module template instances for reusable module generation */
  moduleInstances?: ModuleInstance[];
}

export interface PipelineResult {
  files: GeneratedFiles;
  collectedVariables: TerraformVariable[];
}

/**
 * Main HCL generation orchestrator.
 * Takes diagram resources + project config and produces Terraform files.
 */
export class HclPipeline {
  constructor(private registry: PluginRegistry) {}

  generate(input: PipelineInput): PipelineResult {
    const { resources, projectConfig } = input;
    const modules = input.modules ?? [];
    const moduleInstances = input.moduleInstances ?? [];

    // 1. Build resource map (instanceId -> ResourceInstance)
    const resourceMap = new Map<string, ResourceInstance>();
    for (const resource of resources) {
      resourceMap.set(resource.instanceId, resource);
    }

    // 1b. Extract subscription_id from canvas Subscription node (if present)
    let subscriptionId: string | undefined;
    const subscriptionNode = resources.find(
      (r) => r.typeId === 'azurerm/core/subscription',
    );
    if (subscriptionNode) {
      subscriptionId = subscriptionNode.properties['subscription_id'] as string;
    }

    // 1c. Filter out virtual resources (no real Terraform resource)
    const realResources = resources.filter((r) => {
      const schema = this.registry.getResourceSchema(r.typeId);
      return schema && !schema.terraformType.startsWith('_');
    });

    // 2. Build terraform address map (only real resources)
    const addressMap = new Map<string, string>();
    for (const resource of realResources) {
      const schema = this.registry.getResourceSchema(resource.typeId);
      if (schema) {
        addressMap.set(
          resource.instanceId,
          `${schema.terraformType}.${resource.terraformName}`,
        );
      }
    }

    // 2b. Partition resources by module
    const moduleResourceMap = new Map<string, ResourceInstance[]>();
    const rootResources: ResourceInstance[] = [];

    for (const resource of realResources) {
      if (resource.moduleId && modules.some((m) => m.id === resource.moduleId)) {
        const list = moduleResourceMap.get(resource.moduleId) ?? [];
        list.push(resource);
        moduleResourceMap.set(resource.moduleId, list);
      } else {
        rootResources.push(resource);
      }
    }

    // If no modules with resources, run the original non-module path (unchanged behavior)
    if (moduleResourceMap.size === 0) {
      return this.generateFlat(input, realResources, resourceMap, addressMap, subscriptionId);
    }

    // ── Module-aware generation ────────────────────────────────────

    // 3. Set up root-level collectors
    const variableCollector = new VariableCollector();
    const outputCollector = new OutputCollector();

    // 4. Create module contexts FIRST (before root context, so root can auto-register outputs)
    const files: GeneratedFiles = {} as GeneratedFiles;
    const moduleBlockLines: string[] = [];
    const moduleContexts = new Map<string, { ctx: ModuleHclContext; memberIds: Set<string>; moduleAddrMap: Map<string, string> }>();

    for (const mod of modules) {
      const modResources = moduleResourceMap.get(mod.id);
      if (!modResources || modResources.length === 0) continue;

      const memberIds = new Set(modResources.map((r) => r.instanceId));

      // Build module-scoped address map
      const moduleAddrMap = new Map<string, string>();
      for (const resource of modResources) {
        const schema = this.registry.getResourceSchema(resource.typeId);
        if (schema) {
          moduleAddrMap.set(
            resource.instanceId,
            `${schema.terraformType}.${resource.terraformName}`,
          );
        }
      }

      // Create module-scoped context
      const moduleCtx = new ModuleHclContext(
        memberIds,
        resourceMap,
        addressMap,
        moduleAddrMap,
        projectConfig.providerConfigs,
      );
      moduleContexts.set(mod.id, { ctx: moduleCtx, memberIds, moduleAddrMap });
    }

    // 5. Create root generation context (with access to module contexts for auto-registering outputs)
    const context = this.createRootContext(resourceMap, addressMap, variableCollector, outputCollector, projectConfig, modules, moduleContexts);

    // 6. Generate HCL for root resources (this may auto-register module outputs via getAttributeReference)
    const rootBlocks = this.generateResourceBlocks(rootResources, resourceMap, context, input.bindings);

    // 7a. Generate per-module HCL blocks (resource generators + intra-module bindings)
    const moduleBlocks = new Map<string, HclBlock[]>();
    for (const mod of modules) {
      const modResources = moduleResourceMap.get(mod.id);
      if (!modResources || modResources.length === 0) continue;

      const entry = moduleContexts.get(mod.id);
      if (!entry) continue;
      const { ctx: moduleCtx, memberIds } = entry;

      const modBlocks: HclBlock[] = [];
      for (const resource of modResources) {
        const cleanResource = this.stripCostKeys(resource);
        const generator = this.registry.getHclGenerator(cleanResource.typeId);
        const blocks = generator.generate(cleanResource, moduleCtx);
        modBlocks.push(...blocks);
      }

      // Generate bindings within the module (both endpoints in the same module)
      for (const binding of input.bindings ?? []) {
        if (!memberIds.has(binding.sourceInstanceId) || !memberIds.has(binding.targetInstanceId)) continue;
        const source = resourceMap.get(binding.sourceInstanceId);
        const target = resourceMap.get(binding.targetInstanceId);
        if (!source || !target) continue;
        const generator = this.registry.getBindingGenerator(source.typeId, target.typeId);
        if (!generator) continue;
        modBlocks.push(...generator.generate(source, target, moduleCtx, binding.sourceAttribute));
      }

      moduleBlocks.set(mod.id, modBlocks);
    }

    // 7b. Handle cross-module bindings (source and target in DIFFERENT modules, or one in module + one in root).
    // Process each binding exactly once to avoid duplication.
    for (const binding of input.bindings ?? []) {
      const src = resourceMap.get(binding.sourceInstanceId);
      const tgt = resourceMap.get(binding.targetInstanceId);
      if (!src || !tgt) continue;

      const srcModuleId = src.moduleId && modules.some((m) => m.id === src.moduleId) ? src.moduleId : undefined;
      const tgtModuleId = tgt.moduleId && modules.some((m) => m.id === tgt.moduleId) ? tgt.moduleId : undefined;

      // Skip if both are in the same module (already handled above) or both are in root
      if (srcModuleId === tgtModuleId) continue;

      // Source is in a module — register output for the source attribute
      if (srcModuleId) {
        const srcEntry = moduleContexts.get(srcModuleId);
        if (srcEntry) {
          const srcAddr = srcEntry.moduleAddrMap.get(binding.sourceInstanceId);
          if (srcAddr) {
            const outputName = `${src.terraformName}_${binding.sourceAttribute}`;
            srcEntry.ctx.addModuleOutput(
              outputName,
              `${srcAddr}.${binding.sourceAttribute}`,
              `${binding.sourceAttribute} of ${src.terraformName}`,
            );
          }
        }
      }

      // Target is in a module — register output for its id
      if (tgtModuleId) {
        const tgtEntry = moduleContexts.get(tgtModuleId);
        if (tgtEntry) {
          const tgtAddr = tgtEntry.moduleAddrMap.get(binding.targetInstanceId);
          if (tgtAddr) {
            const outputName = `${tgt.terraformName}_id`;
            tgtEntry.ctx.addModuleOutput(outputName, `${tgtAddr}.id`, `ID of ${tgt.terraformName}`);
          }
        }
      }

      // Generate the binding resource at root level (once)
      const generator = this.registry.getBindingGenerator(src.typeId, tgt.typeId);
      if (generator) {
        rootBlocks.push(...generator.generate(src, tgt, context, binding.sourceAttribute));
      }
    }

    // 7c. Assemble per-module files (after all cross-module outputs have been registered)
    for (const mod of modules) {
      const modBlocks = moduleBlocks.get(mod.id);
      if (!modBlocks) continue;

      const entry = moduleContexts.get(mod.id);
      if (!entry) continue;
      const { ctx: moduleCtx } = entry;

      // Topological sort for module blocks
      const modDepGraph = new DependencyGraph(modBlocks);
      const sortedModBlocks = modDepGraph.topologicalSort();

      // Get wiring (now includes cross-module outputs registered in step 7b)
      const wiring = moduleCtx.getWiring();

      // Build module variables collector
      const modVarCollector = new VariableCollector();
      for (const v of wiring.inputVariables) {
        modVarCollector.add(v);
      }

      // Build module output collector
      const modOutputCollector = new OutputCollector();
      for (const o of wiring.outputDeclarations) {
        modOutputCollector.add(o);
      }
      // Also include any outputs registered by generators
      for (const o of moduleCtx.getOutputCollector().getAll()) {
        modOutputCollector.add(o);
      }

      // Assemble module files
      const modMainContent = sortedModBlocks
        .filter((b) => b.blockType === 'resource' || b.blockType === 'data')
        .map((b) => b.content)
        .join('\n\n');

      const prefix = `modules/${mod.name}`;
      files[`${prefix}/main.tf`] = modMainContent;
      const modVarsHcl = modVarCollector.generateVariablesHcl();
      if (modVarsHcl) files[`${prefix}/variables.tf`] = modVarsHcl;
      const modOutputsHcl = modOutputCollector.generateOutputsHcl();
      if (modOutputsHcl) files[`${prefix}/outputs.tf`] = modOutputsHcl;
      // Modules have their own scope — replicate locals (common_tags) so generators work
      const modLocalsHcl = this.generateLocals(projectConfig);
      if (modLocalsHcl) files[`${prefix}/locals.tf`] = modLocalsHcl;

      // Generate root module block(s)
      const templateInstances = mod.isTemplate
        ? moduleInstances.filter((inst) => inst.templateId === mod.id)
        : [];

      if (mod.isTemplate && templateInstances.length > 0) {
        // Template with instances: one module block per instance
        for (const instance of templateInstances) {
          const instBlockLines: string[] = [`module "${instance.name}" {`];
          instBlockLines.push(`  source = "./modules/${mod.name}"`);
          for (const [varName, expression] of wiring.moduleBlockInputs) {
            // Check if this instance has a variable override
            const override = instance.variableValues[varName];
            if (override !== undefined && override !== '') {
              instBlockLines.push(`  ${varName} = ${this.formatVariableValue(override)}`);
            } else {
              instBlockLines.push(`  ${varName} = ${expression}`);
            }
          }
          instBlockLines.push('}');
          moduleBlockLines.push(instBlockLines.join('\n'));
        }
      } else if (!mod.isTemplate) {
        // Regular (non-template) module: single module block
        const modBlockLines: string[] = [`module "${mod.name}" {`];
        modBlockLines.push(`  source = "./modules/${mod.name}"`);
        for (const [varName, expression] of wiring.moduleBlockInputs) {
          modBlockLines.push(`  ${varName} = ${expression}`);
        }
        modBlockLines.push('}');
        moduleBlockLines.push(modBlockLines.join('\n'));
      }
      // else: template with no instances — generate module directory but no module block

      // Register module variables at root level (so they appear in root variables.tf)
      // For templates, only register if there are no instances (instances provide their own values)
      if (!mod.isTemplate || templateInstances.length === 0) {
        for (const v of moduleCtx.getVariableCollector().getAll()) {
          variableCollector.add(v);
        }
      }
    }

    // 8. Topological sort root blocks
    const depGraph = new DependencyGraph(rootBlocks);
    const sortedBlocks = depGraph.topologicalSort();

    // 8. Build provider configs
    const providerBuilder = new ProviderConfigBuilder();
    const activeProviders = this.getActiveProviders(realResources);

    for (const providerId of activeProviders) {
      const providerConfig = this.registry.getProviderConfig(providerId);
      if (providerConfig) {
        const userConfig = { ...(projectConfig.providerConfigs[providerId] ?? {}) };
        if (providerId === 'azurerm' && subscriptionId) {
          userConfig['subscription_id'] = subscriptionId;
        }
        providerBuilder.addProvider(providerConfig, userConfig);
      }
    }

    // 9. Generate locals for common tags
    const localsHcl = this.generateLocals(projectConfig);

    // 10. Assemble root files
    const blockBuilder = new HclBlockBuilder();
    const rootFiles = blockBuilder.assemble(
      sortedBlocks,
      providerBuilder.generateTerraformBlock('>= 1.0', projectConfig.backend),
      providerBuilder.generateProviderBlocks(),
      variableCollector.generateVariablesHcl(),
      outputCollector.generateOutputsHcl(),
      localsHcl,
    );

    // Append module blocks to root main.tf
    if (moduleBlockLines.length > 0) {
      const separator = rootFiles['main.tf'] ? '\n\n' : '';
      rootFiles['main.tf'] = rootFiles['main.tf'] + separator + moduleBlockLines.join('\n\n');
    }

    // Merge root files into the result
    Object.assign(files, rootFiles);

    // 11. Generate terraform.tfvars
    const allVars = variableCollector.getAll();
    const tfvars = this.generateTfvars(allVars, projectConfig);
    if (tfvars.trim()) {
      files['terraform.tfvars'] = tfvars;
    }

    // 12. Generate terraform.tfvars.example
    if (allVars.length > 0) {
      files['terraform.tfvars.example'] = this.generateTfvarsExample(allVars, projectConfig);
    }

    // 13. Generate .gitignore
    files['.gitignore'] = this.generateGitignore();

    return {
      files,
      collectedVariables: allVars,
    };
  }

  /**
   * Original flat generation (no modules). Preserved for backward compatibility.
   */
  private generateFlat(
    input: PipelineInput,
    realResources: ResourceInstance[],
    resourceMap: Map<string, ResourceInstance>,
    addressMap: Map<string, string>,
    subscriptionId: string | undefined,
  ): PipelineResult {
    const { projectConfig } = input;
    const variableCollector = new VariableCollector();
    const outputCollector = new OutputCollector();

    const context = this.createRootContext(resourceMap, addressMap, variableCollector, outputCollector, projectConfig);

    const allBlocks = this.generateResourceBlocks(realResources, resourceMap, context, input.bindings);

    // Topological sort
    const depGraph = new DependencyGraph(allBlocks);
    const sortedBlocks = depGraph.topologicalSort();

    // Build provider configs
    const providerBuilder = new ProviderConfigBuilder();
    const activeProviders = this.getActiveProviders(realResources);

    for (const providerId of activeProviders) {
      const providerConfig = this.registry.getProviderConfig(providerId);
      if (providerConfig) {
        const userConfig = { ...(projectConfig.providerConfigs[providerId] ?? {}) };
        if (providerId === 'azurerm' && subscriptionId) {
          userConfig['subscription_id'] = subscriptionId;
        }
        providerBuilder.addProvider(providerConfig, userConfig);
      }
    }

    const localsHcl = this.generateLocals(projectConfig);
    const blockBuilder = new HclBlockBuilder();
    const files = blockBuilder.assemble(
      sortedBlocks,
      providerBuilder.generateTerraformBlock('>= 1.0', projectConfig.backend),
      providerBuilder.generateProviderBlocks(),
      variableCollector.generateVariablesHcl(),
      outputCollector.generateOutputsHcl(),
      localsHcl,
    );

    const allVars = variableCollector.getAll();
    const tfvars = this.generateTfvars(allVars, projectConfig);
    if (tfvars.trim()) files['terraform.tfvars'] = tfvars;
    if (allVars.length > 0) files['terraform.tfvars.example'] = this.generateTfvarsExample(allVars, projectConfig);
    files['.gitignore'] = this.generateGitignore();

    return { files, collectedVariables: allVars };
  }

  /**
   * Create a root-level HCL generation context.
   * For resources in the root module (not inside any Terraform module).
   * When modules are present, cross-module references use module.X.output_name.
   */
  private createRootContext(
    resourceMap: Map<string, ResourceInstance>,
    addressMap: Map<string, string>,
    variableCollector: VariableCollector,
    outputCollector: OutputCollector,
    projectConfig: ProjectConfig,
    modules?: ModuleDefinition[],
    moduleContexts?: Map<string, { ctx: ModuleHclContext; memberIds: Set<string>; moduleAddrMap: Map<string, string> }>,
  ): HclGenerationContext {
    /**
     * If a resource belongs to a module, auto-register an output on the module context
     * and return the module.X.output_name reference for use at root level.
     */
    function resolveModuleRef(instanceId: string, attribute: string): string | undefined {
      if (!modules || modules.length === 0) return undefined;
      const resource = resourceMap.get(instanceId);
      if (!resource?.moduleId) return undefined;
      const mod = modules.find((m) => m.id === resource.moduleId);
      if (!mod) return undefined;

      const outputName = `${resource.terraformName}_${attribute}`;

      // Auto-register the output on the module context if available
      if (moduleContexts) {
        const entry = moduleContexts.get(mod.id);
        if (entry) {
          const internalAddr = entry.moduleAddrMap.get(instanceId);
          if (internalAddr) {
            entry.ctx.addModuleOutput(
              outputName,
              `${internalAddr}.${attribute}`,
              `${attribute} of ${resource.terraformName}`,
            );
          }
        }
      }

      return `module.${mod.name}.${outputName}`;
    }

    return {
      getResource(instanceId: string) {
        return resourceMap.get(instanceId);
      },
      getTerraformAddress(instanceId: string) {
        // If the resource is in a module, return module.X as the dependency address
        if (modules && modules.length > 0) {
          const resource = resourceMap.get(instanceId);
          if (resource?.moduleId) {
            const mod = modules.find((m) => m.id === resource.moduleId);
            if (mod) return `module.${mod.name}`;
          }
        }
        return addressMap.get(instanceId);
      },
      getAttributeReference(instanceId: string, attribute: string) {
        // If the resource belongs to a module, reference via module.X.output_name
        const moduleRef = resolveModuleRef(instanceId, attribute);
        if (moduleRef) return moduleRef;

        const addr = addressMap.get(instanceId);
        if (!addr) {
          throw new Error(
            `Cannot resolve reference to instance "${instanceId}": not found`,
          );
        }
        return `${addr}.${attribute}`;
      },
      addVariable(variable: TerraformVariable) {
        variableCollector.add(variable);
      },
      addOutput(output: TerraformOutput) {
        outputCollector.add(output);
      },
      getProviderConfig(providerId: string) {
        return projectConfig.providerConfigs[providerId] ?? {};
      },
      getResourceGroupExpression(resource: ResourceInstance) {
        const rgInstanceId = resource.references['_resource_group'];
        if (rgInstanceId) {
          // If the RG is in a module, reference via module output
          const moduleRef = resolveModuleRef(rgInstanceId, 'name');
          if (moduleRef) return moduleRef;
          const rgAddr = addressMap.get(rgInstanceId);
          if (rgAddr) return `${rgAddr}.name`;
        }
        throw new Error(
          `Resource "${resource.terraformName}" requires a Resource Group but none was found. ` +
          `Place the resource inside a Resource Group container on the canvas.`
        );
      },
      getLocationExpression(resource: ResourceInstance) {
        const rgInstanceId = resource.references['_resource_group'];
        if (rgInstanceId) {
          // If the RG is in a module, reference via module output
          const moduleRef = resolveModuleRef(rgInstanceId, 'location');
          if (moduleRef) return moduleRef;
          const rgAddr = addressMap.get(rgInstanceId);
          if (rgAddr) return `${rgAddr}.location`;
        }
        throw new Error(
          `Resource "${resource.terraformName}" requires a location but no Resource Group was found. ` +
          `Place the resource inside a Resource Group container on the canvas.`
        );
      },
      getPropertyExpression(resource, propertyKey, value, options = {}) {
        const mode = resource.variableOverrides?.[propertyKey] ?? 'literal';
        if (mode === 'variable') {
          const varName = options.variableName ?? `${resource.terraformName}_${propertyKey}`;
          const varType = options.variableType ??
            (Array.isArray(value) ? 'list(string)' :
            typeof value === 'boolean' ? 'bool' :
            typeof value === 'number' ? 'number' : 'string');
          const varDesc = options.variableDescription ?? `${propertyKey} for ${resource.terraformName}`;
          variableCollector.add({ name: varName, type: varType, description: varDesc, defaultValue: value, sensitive: options.sensitive });
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
      },
    };
  }

  /**
   * Generate HCL blocks for a set of resources using a given context.
   * Also processes output bindings where both endpoints are in the resource set.
   */
  private generateResourceBlocks(
    resources: ResourceInstance[],
    resourceMap: Map<string, ResourceInstance>,
    context: HclGenerationContext,
    bindings?: OutputBinding[],
  ): HclBlock[] {
    const allBlocks: HclBlock[] = [];
    const resourceIds = new Set(resources.map((r) => r.instanceId));

    for (const resource of resources) {
      const cleanResource = this.stripCostKeys(resource);
      const generator = this.registry.getHclGenerator(cleanResource.typeId);
      const blocks = generator.generate(cleanResource, context);
      allBlocks.push(...blocks);
    }

    for (const binding of bindings ?? []) {
      if (!resourceIds.has(binding.sourceInstanceId) || !resourceIds.has(binding.targetInstanceId)) continue;
      const source = resourceMap.get(binding.sourceInstanceId);
      const target = resourceMap.get(binding.targetInstanceId);
      if (!source || !target) continue;
      const generator = this.registry.getBindingGenerator(source.typeId, target.typeId);
      if (!generator) continue;
      allBlocks.push(...generator.generate(source, target, context, binding.sourceAttribute));
    }

    return allBlocks;
  }

  /** Format a variable value for HCL output. */
  private formatVariableValue(value: unknown): string {
    if (typeof value === 'string') return `"${escapeHclString(value)}"`;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (value === null || value === undefined) return 'null';
    return JSON.stringify(value);
  }

  /** Strip _cost_* keys from resource properties before generation. */
  private stripCostKeys(resource: ResourceInstance): ResourceInstance {
    return {
      ...resource,
      properties: Object.fromEntries(
        Object.entries(resource.properties).filter(([k]) => !k.startsWith('_cost_')),
      ),
    };
  }

  private getActiveProviders(resources: ResourceInstance[]): Set<ProviderId> {
    const providers = new Set<ProviderId>();
    for (const resource of resources) {
      const schema = this.registry.getResourceSchema(resource.typeId);
      if (schema) {
        providers.add(schema.provider);
      }
    }
    return providers;
  }

  private generateTfvars(
    variables: TerraformVariable[],
    config: ProjectConfig,
  ): string {
    const values: Record<string, string> = { ...(config.variableValues ?? {}) };
    const lines: string[] = [];

    for (const v of variables) {
      const value = values[v.name];
      if (value !== undefined && value !== '') {
        lines.push(`${v.name} = ${this.formatTfvarValue(value, v.type)}`);
      }
    }

    return lines.join('\n');
  }

  /** Format a user-supplied variable value for terraform.tfvars based on its declared type. */
  private formatTfvarValue(value: string, type: string): string {
    if (type === 'number') return value;
    if (type === 'bool') return value;
    if (type.startsWith('list(')) {
      // User enters comma-separated values; wrap as HCL list
      const items = value.split(',').map((s) => s.trim()).filter(Boolean);
      return `[${items.map((i) => `"${escapeHclString(i)}"`).join(', ')}]`;
    }
    return `"${escapeHclString(value)}"`;
  }

  /**
   * Generate terraform.tfvars.example with real values for non-sensitive variables
   * and placeholder comments for sensitive ones.
   */
  private generateTfvarsExample(
    variables: TerraformVariable[],
    config: ProjectConfig,
  ): string {
    const values: Record<string, string> = { ...(config.variableValues ?? {}) };
    const lines: string[] = [
      '# Terraform variable values',
      '# Copy this file to terraform.tfvars and fill in sensitive values.',
      '# Do NOT commit terraform.tfvars to version control.',
      '',
    ];

    for (const v of variables) {
      const value = values[v.name];
      if (v.sensitive) {
        lines.push(`# ${v.name} = "" # sensitive — set in terraform.tfvars`);
      } else if (value !== undefined && value !== '') {
        lines.push(`${v.name} = ${this.formatTfvarValue(value, v.type)}`);
      } else if (v.defaultValue !== undefined) {
        const defaultStr = Array.isArray(v.defaultValue)
          ? `[${v.defaultValue.map((i: unknown) => `"${escapeHclString(String(i))}"`).join(', ')}]`
          : `"${escapeHclString(String(v.defaultValue))}"`;
        lines.push(`# ${v.name} = ${defaultStr} # has default`);
      } else {
        const emptyVal = v.type.startsWith('list(') ? '[]' : '""';
        lines.push(`${v.name} = ${emptyVal} # required`);
      }
    }

    return lines.join('\n');
  }

  /** Generate a .gitignore for the terraform working directory. */
  private generateGitignore(): string {
    return [
      '# Terraform',
      '.terraform/',
      '.terraform.lock.hcl',
      '*.tfstate',
      '*.tfstate.*',
      'crash.log',
      'crash.*.log',
      '',
      '# Variable values may contain secrets',
      'terraform.tfvars',
      '*.auto.tfvars',
      '',
      '# Override files',
      'override.tf',
      'override.tf.json',
      '*_override.tf',
      '*_override.tf.json',
    ].join('\n');
  }

  private generateLocals(config: ProjectConfig): string {
    const tags = config.commonTags;
    if (Object.keys(tags).length === 0) return '';

    const tagEntries = Object.entries(tags)
      .map(([k, v]) => `    ${k} = "${escapeHclString(v)}"`)
      .join('\n');

    return `locals {\n  common_tags = {\n${tagEntries}\n  }\n}`;
  }
}
