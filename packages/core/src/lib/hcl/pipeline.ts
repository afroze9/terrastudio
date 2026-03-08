import type {
  ResourceInstance,
  ResourceSchema,
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
import { ProviderConfigBuilder, sanitizeProviderAlias } from './provider-config-builder.js';
import { HclBlockBuilder, type GeneratedFiles } from './block-builder.js';
import { ModuleHclContext } from './module-context.js';
import { escapeHclString } from './escape.js';

export type LayoutAlgorithm = 'dagre' | 'hybrid';

export interface ProjectConfig {
  providerConfigs: Record<ProviderId, Record<string, unknown>>;
  commonTags: Record<string, string>;
  variableValues: Record<string, unknown>;
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
  errors?: PipelineValidationError[];
}

export interface PipelineValidationError {
  code: string;
  message: string;
  resourceNames?: string[];
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

    // 1b. Collect all subscription nodes
    const subscriptionNodes = resources.filter(
      (r) => r.typeId === 'azurerm/core/subscription',
    );
    const isMultiSubscription = subscriptionNodes.length > 1;

    // For single-subscription backward compat: extract subscription_id
    let subscriptionId: string | undefined;
    if (subscriptionNodes.length === 1) {
      subscriptionId = subscriptionNodes[0]!.properties['subscription_id'] as string;
    }

    // Build subscription alias map for multi-subscription
    const subscriptionAliasMap = new Map<string, string>(); // nodeId → alias
    const subscriptionConfigMap = new Map<string, string>(); // alias → subscription_id
    if (isMultiSubscription) {
      for (const sub of subscriptionNodes) {
        const displayName = (sub.properties['display_name'] as string) || sub.terraformName;
        const subId = sub.properties['subscription_id'] as string;
        const alias = sanitizeProviderAlias(displayName);
        subscriptionAliasMap.set(sub.instanceId, alias);
        subscriptionConfigMap.set(alias, subId);
      }
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

    // 2c. Multi-subscription validation: ensure all resources have a subscription ancestor
    if (isMultiSubscription) {
      const orphans = realResources.filter((r) => {
        // Skip resource groups — they get their subscription from their own ancestry
        // but we check all real resources that will generate HCL
        return !r.references['_subscription'];
      });
      if (orphans.length > 0) {
        const orphanNames = orphans.map((r) => r.terraformName);
        return {
          files: {} as GeneratedFiles,
          collectedVariables: [],
          errors: [{
            code: 'MULTI_SUB_ORPHAN_RESOURCES',
            message: `Multiple subscriptions detected but the following resources are not placed inside any subscription: ${orphanNames.join(', ')}. Place all resources under a subscription container.`,
            resourceNames: orphanNames,
          }],
        };
      }
    }

    // If no modules with resources, run the original non-module path (unchanged behavior)
    if (moduleResourceMap.size === 0) {
      return this.generateFlat(input, realResources, resourceMap, addressMap, subscriptionId, subscriptionAliasMap, subscriptionConfigMap);
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

    // 8. Multi-subscription: tag root blocks with providerAlias
    if (isMultiSubscription) {
      const injected = this.injectProviderAliases(rootBlocks, resourceMap, subscriptionAliasMap);
      rootBlocks.length = 0;
      rootBlocks.push(...injected);
    }

    // 8b. Topological sort root blocks
    const depGraph = new DependencyGraph(rootBlocks);
    const sortedBlocks = depGraph.topologicalSort();

    // 9. Build provider configs
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

    // Register aliased providers for multi-subscription
    if (isMultiSubscription) {
      for (const [alias, subId] of subscriptionConfigMap) {
        providerBuilder.addAliasedProvider({
          providerType: 'azurerm',
          alias,
          config: { subscription_id: subId },
        });
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
    subscriptionAliasMap?: Map<string, string>,
    subscriptionConfigMap?: Map<string, string>,
  ): PipelineResult {
    const { projectConfig } = input;
    const variableCollector = new VariableCollector();
    const outputCollector = new OutputCollector();

    const context = this.createRootContext(resourceMap, addressMap, variableCollector, outputCollector, projectConfig);

    let allBlocks = this.generateResourceBlocks(realResources, resourceMap, context, input.bindings);

    // Multi-subscription: tag blocks with providerAlias and inject provider line
    const isMultiSub = subscriptionAliasMap && subscriptionAliasMap.size > 0;
    if (isMultiSub) {
      allBlocks = this.injectProviderAliases(allBlocks, resourceMap, subscriptionAliasMap);
    }

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

    // Register aliased providers for multi-subscription
    if (isMultiSub && subscriptionConfigMap) {
      for (const [alias, subId] of subscriptionConfigMap) {
        providerBuilder.addAliasedProvider({
          providerType: 'azurerm',
          alias,
          config: { subscription_id: subId },
        });
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

    // Generate implicit Private Endpoint resources for visual containment in subnets
    for (const resource of resources) {
      const schema = this.registry.getResourceSchema(resource.typeId);
      if (!schema?.privateEndpointConfig) continue;
      const subnetId = resource.references['_visual_subnet'];
      if (!subnetId) continue;

      const pepBlocks = this.generateImplicitPep(resource, subnetId, schema, context);
      allBlocks.push(...pepBlocks);
    }

    return allBlocks;
  }

  /**
   * For multi-subscription projects: tag each HCL block with the correct provider alias
   * and inject `provider = azurerm.<alias>` into the block's content string.
   * Blocks are matched to subscriptions via the generating resource's `_subscription` reference.
   */
  private injectProviderAliases(
    blocks: HclBlock[],
    resourceMap: Map<string, ResourceInstance>,
    subscriptionAliasMap: Map<string, string>,
  ): HclBlock[] {
    // Build a terraform name → subscription alias lookup
    const tfNameToAlias = new Map<string, string>();
    for (const resource of resourceMap.values()) {
      const subNodeId = resource.references['_subscription'];
      if (subNodeId) {
        const alias = subscriptionAliasMap.get(subNodeId);
        if (alias) {
          tfNameToAlias.set(resource.terraformName, alias);
        }
      }
    }

    // Sort terraform names by length descending so longer names match first
    // (avoids "rg_1" matching "rg_1_something" when "rg_1_something" is a real name)
    const sortedTfNames = [...tfNameToAlias.entries()].sort(
      (a, b) => b[0].length - a[0].length,
    );

    return blocks.map((block) => {
      // Only inject into resource and data blocks
      if (block.blockType !== 'resource' && block.blockType !== 'data') return block;
      if (!block.name) return block;

      // 1. Exact match by block name
      let alias: string | undefined = tfNameToAlias.get(block.name);

      // 2. Prefix match for generated blocks (PEP, bindings, etc.)
      //    e.g., pe_mssql_server_xxx, mssql_server_xxx_fully_qualified_domain_name
      if (!alias) {
        for (const [tfName, a] of sortedTfNames) {
          if (block.name.startsWith(`pe_${tfName}`) || block.name.startsWith(`${tfName}_`)) {
            alias = a;
            break;
          }
        }
      }

      // 3. Fallback for shared data sources: resolve via dependsOn
      if (!alias && block.dependsOn) {
        for (const dep of block.dependsOn) {
          // dependsOn entries are terraform addresses like "azurerm_resource_group.rg_1"
          const dotIdx = dep.lastIndexOf('.');
          const depName = dotIdx >= 0 ? dep.slice(dotIdx + 1) : dep;
          const depAlias = tfNameToAlias.get(depName);
          if (depAlias) {
            alias = depAlias;
            break;
          }
        }
      }

      if (!alias) return block;

      // Inject `provider = azurerm.<alias>` after the opening brace
      const content = injectProviderLine(block.content, 'azurerm', alias);
      return { ...block, providerAlias: alias, content };
    });
  }

  /**
   * Generate implicit Private Endpoint HCL blocks for a resource visually placed in a subnet.
   */
  private generateImplicitPep(
    resource: ResourceInstance,
    subnetId: string,
    schema: ResourceSchema,
    context: HclGenerationContext,
  ): HclBlock[] {
    const pepConfig = schema.privateEndpointConfig!;
    const selectedSubs = (resource.properties['pep_subresources'] as string[] | undefined)
      ?? [pepConfig.defaultSubresource];

    if (selectedSubs.length === 0) return [];

    const blocks: HclBlock[] = [];
    const subnetExpr = context.getAttributeReference(subnetId, 'id');
    const targetExpr = context.getAttributeReference(resource.instanceId, 'id');
    const rgExpr = context.getResourceGroupExpression(resource);
    const locationExpr = context.getLocationExpression(resource);

    const resourceAddr = context.getTerraformAddress(resource.instanceId);
    const subnetAddr = context.getTerraformAddress(subnetId);
    const dependsOn: string[] = [];
    if (resourceAddr) dependsOn.push(resourceAddr);
    if (subnetAddr) dependsOn.push(subnetAddr);

    for (const sub of selectedSubs) {
      const pepName = `pe_${resource.terraformName}_${sub}`;
      const lines: string[] = [
        `resource "azurerm_private_endpoint" "${pepName}" {`,
        `  name                = "pe-${resource.terraformName}-${sub}"`,
        `  resource_group_name = ${rgExpr}`,
        `  location            = ${locationExpr}`,
        `  subnet_id           = ${subnetExpr}`,
        ``,
        `  private_service_connection {`,
        `    name                           = "pe-${resource.terraformName}-${sub}-psc"`,
        `    private_connection_resource_id = ${targetExpr}`,
        `    subresource_names              = ["${sub}"]`,
        `    is_manual_connection           = false`,
        `  }`,
      ];

      // Add Private DNS Zone group if enabled
      const dnsEnabled = resource.properties['pep_dns_zone_enabled'];
      if (dnsEnabled) {
        lines.push(``);
        lines.push(`  # Private DNS Zone integration — configure dns_zone_id on the resource`);
      }

      lines.push(`}`);

      blocks.push({
        blockType: 'resource',
        terraformType: 'azurerm_private_endpoint',
        name: pepName,
        content: lines.join('\n'),
        dependsOn,
      });
    }

    return blocks;
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
    const values = config.variableValues ?? {};
    const lines: string[] = [];

    for (const v of variables) {
      const value = values[v.name];
      if (value !== undefined && value !== '') {
        lines.push(`${v.name} = ${this.formatTfvarValue(value)}`);
      }
    }

    return lines.join('\n');
  }

  /** Format a variable value for terraform.tfvars. Handles strings, numbers, booleans, and arrays. */
  private formatTfvarValue(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((i) => `"${escapeHclString(String(i))}"`).join(', ')}]`;
    }
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return `"${escapeHclString(String(value))}"`;
  }

  /**
   * Generate terraform.tfvars.example with real values for non-sensitive variables
   * and placeholder comments for sensitive ones.
   */
  private generateTfvarsExample(
    variables: TerraformVariable[],
    config: ProjectConfig,
  ): string {
    const values = config.variableValues ?? {};
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
        lines.push(`${v.name} = ${this.formatTfvarValue(value)}`);
      } else if (v.defaultValue !== undefined) {
        lines.push(`# ${v.name} = ${this.formatTfvarValue(v.defaultValue)} # has default`);
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

/**
 * Inject `provider = <providerType>.<alias>` into an HCL block string after the opening `{`.
 */
function injectProviderLine(content: string, providerType: string, alias: string): string {
  const openBrace = content.indexOf('{');
  if (openBrace === -1) return content;
  return content.slice(0, openBrace + 1) + `\n  provider = ${providerType}.${alias}` + content.slice(openBrace + 1);
}
