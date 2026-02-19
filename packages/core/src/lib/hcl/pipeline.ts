import type {
  ResourceInstance,
  HclBlock,
  HclGenerationContext,
  TerraformVariable,
  TerraformOutput,
  ProviderId,
} from '@terrastudio/types';
import type { PluginRegistry } from '../registry/plugin-registry.js';
import { DependencyGraph } from './dependency-graph.js';
import { VariableCollector, OutputCollector } from './variable-collector.js';
import { ProviderConfigBuilder } from './provider-config-builder.js';
import { HclBlockBuilder, type GeneratedFiles } from './block-builder.js';

export interface ProjectConfig {
  providerConfigs: Record<ProviderId, Record<string, unknown>>;
  resourceGroupName: string;
  resourceGroupAsVariable: boolean;
  location: string;
  locationAsVariable: boolean;
  commonTags: Record<string, string>;
  backend?: {
    type: string;
    config: Record<string, string>;
  };
}

export interface PipelineInput {
  resources: ResourceInstance[];
  projectConfig: ProjectConfig;
}

/**
 * Main HCL generation orchestrator.
 * Takes diagram resources + project config and produces Terraform files.
 */
export class HclPipeline {
  constructor(private registry: PluginRegistry) {}

  generate(input: PipelineInput): GeneratedFiles {
    const { resources, projectConfig } = input;

    // 1. Build resource map (instanceId -> ResourceInstance)
    const resourceMap = new Map<string, ResourceInstance>();
    for (const resource of resources) {
      resourceMap.set(resource.instanceId, resource);
    }

    // 2. Build terraform address map
    const addressMap = new Map<string, string>();
    for (const resource of resources) {
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

    // Add standard variables
    if (projectConfig.resourceGroupAsVariable) {
      variableCollector.add({
        name: 'resource_group_name',
        type: 'string',
        description: 'Name of the Azure Resource Group',
        defaultValue: projectConfig.resourceGroupName || undefined,
      });
    }

    if (projectConfig.locationAsVariable) {
      variableCollector.add({
        name: 'location',
        type: 'string',
        description: 'Azure region for resources',
        defaultValue: projectConfig.location || undefined,
      });
    }

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
      getResourceGroupExpression() {
        return projectConfig.resourceGroupAsVariable
          ? 'var.resource_group_name'
          : `"${projectConfig.resourceGroupName}"`;
      },
      getLocationExpression() {
        return projectConfig.locationAsVariable
          ? 'var.location'
          : `"${projectConfig.location}"`;
      },
    };

    // 5. Call plugin generators for each resource
    const allBlocks: HclBlock[] = [];
    for (const resource of resources) {
      const generator = this.registry.getHclGenerator(resource.typeId);
      const blocks = generator.generate(resource, context);
      allBlocks.push(...blocks);
    }

    // 6. Topological sort
    const depGraph = new DependencyGraph(allBlocks);
    const sortedBlocks = depGraph.topologicalSort();

    // 7. Build provider configs
    const providerBuilder = new ProviderConfigBuilder();
    const activeProviders = this.getActiveProviders(resources);

    for (const providerId of activeProviders) {
      const providerConfig = this.registry.getProviderConfig(providerId);
      if (providerConfig) {
        const userConfig =
          projectConfig.providerConfigs[providerId] ?? {};
        providerBuilder.addProvider(providerConfig, userConfig);
      }
    }

    // 8. Generate locals for common tags
    const localsHcl = this.generateLocals(projectConfig);

    // 9. Assemble output files
    const blockBuilder = new HclBlockBuilder();
    return blockBuilder.assemble(
      sortedBlocks,
      providerBuilder.generateTerraformBlock('>= 1.0', projectConfig.backend),
      providerBuilder.generateProviderBlocks(),
      variableCollector.generateVariablesHcl(),
      outputCollector.generateOutputsHcl(),
      localsHcl,
    );
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

  private generateLocals(config: ProjectConfig): string {
    const tags = config.commonTags;
    if (Object.keys(tags).length === 0) return '';

    const tagEntries = Object.entries(tags)
      .map(([k, v]) => `    ${k} = "${v}"`)
      .join('\n');

    return `locals {\n  common_tags = {\n${tagEntries}\n  }\n}`;
  }
}
