// Provider types
export type { ProviderId, ProviderConfig } from './provider.js';

// Resource schema types
export type {
  ResourceTypeId,
  PropertyFieldType,
  PropertySchema,
  HandleDefinition,
  ResourceSchema,
} from './resource-schema.js';

// HCL types
export type {
  ResourceInstance,
  HclGenerationContext,
  HclGenerator,
  HclBlock,
  TerraformVariable,
  TerraformOutput,
} from './hcl.js';

// Node types
export type {
  DeploymentStatus,
  ResourceNodeData,
  ResourceNodeComponent,
  PropertyEditorProps,
  PropertyEditorComponent,
} from './node.js';

// Connection types
export type { ConnectionRule } from './connection.js';

// Plugin types
export type {
  IconDefinition,
  PaletteCategory,
  ResourceTypeRegistration,
  PluginRegistryReader,
  InfraPlugin,
} from './plugin.js';

// Validation types
export type { ValidationError, PropertyValidation } from './validation.js';
