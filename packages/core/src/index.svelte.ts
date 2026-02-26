/**
 * Svelte entry point for @terrastudio/core.
 * Re-exports everything from the main index sources plus Svelte-reactive additions.
 * Resolved via the "svelte" export condition in package.json so that the
 * Svelte compiler (Vite + @sveltejs/vite-plugin-svelte) processes .svelte.ts files.
 */

// Re-export everything from the standard (non-Svelte) index, except pluginRegistry
// which is overridden below with the Svelte-reactive version.
export { PluginRegistry, NodeTypeResolver, HclPipeline, HclBlockBuilder, DependencyGraph,
  VariableCollector, OutputCollector, ProviderConfigBuilder, EdgeRuleValidator,
  createNodeData, generateNodeId, generateUniqueTerraformName,
  EdgeCategoryRegistry, edgeCategoryRegistry,
  validateResourceProperties, validateDiagram, validateNetworkTopology,
  parseCidr, isValidCidr, cidrsOverlap, cidrContains, nextAvailableCidr,
  applyNamingTemplate, extractSlug, sanitizeTerraformName, buildTokens,
} from './index.js';
export type { ProjectConfig, LayoutAlgorithm, PipelineInput, PipelineResult,
  GeneratedFiles, EdgeValidationResult, OutputAcceptingHandle,
  DiagramValidationResult, DiagramError, TopologyNode, TopologyError,
  ParsedCidr, NamingTokens,
} from './index.js';

// Svelte-reactive pluginRegistry (overrides the non-reactive one from index.js)
export { pluginRegistry } from './lib/registry/plugin-registry.svelte.js';
export type { PluginLoader } from './lib/registry/plugin-registry.js';
