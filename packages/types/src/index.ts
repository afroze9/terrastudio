// Provider types
export type { ProviderId, ProviderConfig } from './provider.js';

// Resource schema types
export type {
  ResourceTypeId,
  PropertyFieldType,
  PropertySchema,
  HandleDefinition,
  ResourceSchema,
  ContainerStyle,
  OutputDefinition,
  NamingConstraints,
} from './resource-schema.js';

// HCL types
export type {
  ResourceInstance,
  HclGenerationContext,
  HclGenerator,
  HclBlock,
  TerraformVariable,
  TerraformOutput,
  OutputBinding,
  BindingHclGenerator,
} from './hcl.js';

// Node types
export type {
  DeploymentStatus,
  PropertyVariableMode,
  ConnectionPointPosition,
  ConnectionPointConfig,
  HandlePositionOverrides,
  ResourceNodeData,
  ResourceNodeComponent,
  PropertyEditorProps,
  PropertyEditorComponent,
} from './node.js';

// Connection types
export type { ConnectionRule } from './connection.js';

// Edge types
export type {
  EdgeCategoryId,
  EdgeMarkerType,
  EdgeStyleDefinition,
  EdgeCategoryDefinition,
  TerraStudioEdgeData,
} from './edge.js';

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

// Naming convention types
export type { NamingConvention } from './naming.js';

// Access control types
export type { AccessModel, IdentityType, AccessGrant } from './access-control.js';
export {
  KEY_VAULT_RBAC_ROLES,
  KEY_PERMISSIONS,
  SECRET_PERMISSIONS,
  CERTIFICATE_PERMISSIONS,
} from './access-control.js';
