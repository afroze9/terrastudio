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
} from '@terrastudio/types';
import type { PluginRegistry } from '../registry/plugin-registry.js';
import { DependencyGraph } from './dependency-graph.js';
import { VariableCollector, OutputCollector } from './variable-collector.js';
import { ProviderConfigBuilder } from './provider-config-builder.js';
import { HclBlockBuilder, type GeneratedFiles } from './block-builder.js';

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
}

export interface PipelineInput {
  resources: ResourceInstance[];
  projectConfig: ProjectConfig;
  bindings?: OutputBinding[];
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

    // 3. Set up collectors
    const variableCollector = new VariableCollector();
    const outputCollector = new OutputCollector();

    // 4. Create generation context
    const context: HclGenerationContext = {
      getResource(instanceId: string) {
        return resourceMap.get(instanceId);
      },
      getTerraformAddress(instanceId: string) {
        return addressMap.get(instanceId);
      },
      getAttributeReference(instanceId: string, attribute: string) {
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
        // Get the _resource_group reference (set by diagram-converter for resources inside RG containers)
        const rgInstanceId = resource.references['_resource_group'];
        if (rgInstanceId) {
          const rgAddr = addressMap.get(rgInstanceId);
          if (rgAddr) {
            return `${rgAddr}.name`;
          }
        }
        // Fallback: no RG container found — this shouldn't happen for resources that requiresResourceGroup
        throw new Error(
          `Resource "${resource.terraformName}" requires a Resource Group but none was found. ` +
          `Place the resource inside a Resource Group container on the canvas.`
        );
      },
      getLocationExpression(resource: ResourceInstance) {
        // Get the _resource_group reference to derive location from the parent RG
        const rgInstanceId = resource.references['_resource_group'];
        if (rgInstanceId) {
          const rgAddr = addressMap.get(rgInstanceId);
          if (rgAddr) {
            return `${rgAddr}.location`;
          }
        }
        // Fallback: no RG container found
        throw new Error(
          `Resource "${resource.terraformName}" requires a location but no Resource Group was found. ` +
          `Place the resource inside a Resource Group container on the canvas.`
        );
      },
      getPropertyExpression(resource, propertyKey, value, options = {}) {
        const mode = resource.variableOverrides?.[propertyKey] ?? 'literal';

        if (mode === 'variable') {
          // Register a variable and return var.xxx reference
          const varName = options.variableName ?? `${resource.terraformName}_${propertyKey}`;
          const varType = options.variableType ?? (typeof value === 'number' ? 'number' : 'string');
          const varDesc = options.variableDescription ?? `${propertyKey} for ${resource.terraformName}`;

          variableCollector.add({
            name: varName,
            type: varType,
            description: varDesc,
            defaultValue: value,
            sensitive: options.sensitive,
          });

          return `var.${varName}`;
        }

        // Return literal value as HCL expression
        if (typeof value === 'string') {
          return `"${value}"`;
        } else if (typeof value === 'number') {
          return String(value);
        } else if (typeof value === 'boolean') {
          return value ? 'true' : 'false';
        } else if (value === null || value === undefined) {
          return 'null';
        } else {
          // For complex types, just stringify
          return JSON.stringify(value);
        }
      },
    };

    // 5. Call plugin generators for each real resource
    // Strip _cost_* keys before passing to generators — they're cost estimation hints,
    // not Terraform attributes, and must never appear in generated HCL.
    const allBlocks: HclBlock[] = [];
    for (const resource of realResources) {
      const cleanResource: ResourceInstance = {
        ...resource,
        properties: Object.fromEntries(
          Object.entries(resource.properties).filter(([k]) => !k.startsWith('_cost_'))
        ),
      };
      const generator = this.registry.getHclGenerator(cleanResource.typeId);
      const blocks = generator.generate(cleanResource, context);
      allBlocks.push(...blocks);
    }

    // 5b. Generate HCL for output bindings
    for (const binding of input.bindings ?? []) {
      const source = resourceMap.get(binding.sourceInstanceId);
      const target = resourceMap.get(binding.targetInstanceId);
      if (!source || !target) continue;

      const generator = this.registry.getBindingGenerator(
        source.typeId,
        target.typeId,
      );
      if (!generator) continue;

      const blocks = generator.generate(source, target, context, binding.sourceAttribute);
      allBlocks.push(...blocks);
    }

    // 6. Topological sort
    const depGraph = new DependencyGraph(allBlocks);
    const sortedBlocks = depGraph.topologicalSort();

    // 7. Build provider configs
    const providerBuilder = new ProviderConfigBuilder();
    const activeProviders = this.getActiveProviders(realResources);

    for (const providerId of activeProviders) {
      const providerConfig = this.registry.getProviderConfig(providerId);
      if (providerConfig) {
        const userConfig = {
          ...(projectConfig.providerConfigs[providerId] ?? {}),
        };
        // Inject subscription_id from canvas node if present
        if (providerId === 'azurerm' && subscriptionId) {
          userConfig['subscription_id'] = subscriptionId;
        }
        providerBuilder.addProvider(providerConfig, userConfig);
      }
    }

    // 8. Generate locals for common tags
    const localsHcl = this.generateLocals(projectConfig);

    // 9. Assemble output files
    const blockBuilder = new HclBlockBuilder();
    const files = blockBuilder.assemble(
      sortedBlocks,
      providerBuilder.generateTerraformBlock('>= 1.0', projectConfig.backend),
      providerBuilder.generateProviderBlocks(),
      variableCollector.generateVariablesHcl(),
      outputCollector.generateOutputsHcl(),
      localsHcl,
    );

    // 10. Generate terraform.tfvars from variable values
    const tfvars = this.generateTfvars(variableCollector.getAll(), projectConfig);
    if (tfvars.trim()) {
      files['terraform.tfvars'] = tfvars;
    }

    return {
      files,
      collectedVariables: variableCollector.getAll(),
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
        lines.push(`${v.name} = "${value}"`);
      }
    }

    return lines.join('\n');
  }

  private generateLocals(config: ProjectConfig): string {
    const tags = config.commonTags;
    if (Object.keys(tags).length === 0) return '';

    const tagEntries = Object.entries(tags)
      .map(([k, v]) => `    ${k} = "${v}"`)
      .join('\n');

    return `locals {\n  common_tags = {\n${tagEntries}\n  }\n}`;
  }
}
