// Registry
export { PluginRegistry } from './lib/registry/plugin-registry.js';
export { NodeTypeResolver } from './lib/registry/node-type-resolver.js';

// HCL Pipeline
export { HclPipeline } from './lib/hcl/pipeline.js';
export type { ProjectConfig, PipelineInput } from './lib/hcl/pipeline.js';
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
