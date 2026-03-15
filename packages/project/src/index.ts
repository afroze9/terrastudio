// Core project model
export { Project, migrateEdges, resolveActiveProviders } from './lib/project.js';
export type { DiagramSnapshot, ProjectMetadata, LoadedProject } from './lib/project.js';

// Diagram conversion (nodes + edges → ResourceInstances for HCL pipeline)
export { convertToResourceInstances, extractOutputBindings } from './lib/diagram-converter.js';

// Naming token inheritance (provider-agnostic ancestor walk)
export { getNamingOverridesFromAncestors } from './lib/naming-overrides.js';
