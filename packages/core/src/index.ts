// Registry
export { PluginRegistry } from './lib/registry/plugin-registry.js';
export { NodeTypeResolver } from './lib/registry/node-type-resolver.js';

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
export { createNodeData, generateNodeId } from './lib/diagram/node-factory.js';

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
