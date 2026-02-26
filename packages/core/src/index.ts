// Registry
export { PluginRegistry } from './lib/registry/plugin-registry.js';
import type { IReactivePluginRegistry } from './lib/registry/reactive-plugin-registry.interface.js';
export type { IReactivePluginRegistry } from './lib/registry/reactive-plugin-registry.interface.js';
export { NodeTypeResolver } from './lib/registry/node-type-resolver.js';

/**
 * Type-stub for pluginRegistry. At runtime this is overridden by the reactive
 * version from plugin-registry.svelte.ts (via the "svelte" export condition).
 * This declaration exists only so tsc / svelte-check can resolve the type.
 */
export declare const pluginRegistry: IReactivePluginRegistry;

// HCL Pipeline
export { HclPipeline } from './lib/hcl/pipeline.js';
export type { ProjectConfig, LayoutAlgorithm, PipelineInput, PipelineResult } from './lib/hcl/pipeline.js';
export { HclBlockBuilder } from './lib/hcl/block-builder.js';
export type { GeneratedFiles } from './lib/hcl/block-builder.js';
export { DependencyGraph } from './lib/hcl/dependency-graph.js';
export { VariableCollector, OutputCollector } from './lib/hcl/variable-collector.js';
export { ProviderConfigBuilder } from './lib/hcl/provider-config-builder.js';

// Diagram
export { EdgeRuleValidator } from './lib/diagram/edge-rules.js';
export type { EdgeValidationResult, OutputAcceptingHandle } from './lib/diagram/edge-rules.js';
export { createNodeData, generateNodeId, generateUniqueTerraformName } from './lib/diagram/node-factory.js';
export { EdgeCategoryRegistry, edgeCategoryRegistry } from './lib/diagram/edge-category-registry.js';

// Validation
export { validateResourceProperties } from './lib/validation/resource-validator.js';
export { validateDiagram } from './lib/validation/diagram-validator.js';
export type { DiagramValidationResult, DiagramError } from './lib/validation/diagram-validator.js';

// Network Topology Validation
export { validateNetworkTopology } from './lib/validation/network-validator.js';
export type { TopologyNode, TopologyError } from './lib/validation/network-validator.js';

// Networking
export {
  parseCidr,
  isValidCidr,
  cidrsOverlap,
  cidrContains,
  nextAvailableCidr,
} from './lib/networking/cidr-utils.js';
export type { ParsedCidr } from './lib/networking/cidr-utils.js';

// Naming engine
export {
  applyNamingTemplate,
  extractSlug,
  sanitizeTerraformName,
  buildTokens,
} from './lib/naming/naming-engine.js';
export type { NamingTokens } from './lib/naming/naming-engine.js';
