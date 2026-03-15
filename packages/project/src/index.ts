// Core project model
export { Project, migrateEdges, resolveActiveProviders } from './lib/project.js';
export type { DiagramSnapshot, ProjectMetadata, LoadedProject, ProjectValidatorContext } from './lib/project.js';

// Validation (pure, platform-agnostic)
export { validateContainment, validateConnection, validateBounds } from './lib/validation.js';
export type { MutationResult } from './lib/validation.js';

// Diagram conversion (nodes + edges → ResourceInstances for HCL pipeline)
export { convertToResourceInstances, extractOutputBindings } from './lib/diagram-converter.js';

// Naming token inheritance (provider-agnostic ancestor walk)
export { getNamingOverridesFromAncestors } from './lib/naming-overrides.js';
