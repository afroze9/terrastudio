# Type Interfaces

All core TypeScript interfaces live in `@terrastudio/types`. This is the contract between the core and all plugins. Nothing in the core imports provider-specific code - everything flows through these interfaces.

## Provider Types

### ProviderId

```typescript
type ProviderId = string;  // e.g., 'azurerm', 'aws', 'google'
```

### ProviderConfig

Defines a Terraform provider. One plugin per provider should register this.

```typescript
interface ProviderConfig {
  readonly id: ProviderId;
  readonly displayName: string;                    // "Azure Resource Manager"
  readonly source: string;                         // "hashicorp/azurerm"
  readonly version: string;                        // "~> 4.0"
  readonly configSchema: PropertySchema[];         // User-configurable fields (subscription_id, region, etc.)
  readonly defaultConfig: Record<string, unknown>;

  generateProviderBlock(config: Record<string, unknown>): string;
  generateRequiredProvider(): string;
}
```

## Resource Schema Types

### ResourceTypeId

Fully qualified identifier. Format: `{provider}/{category}/{resource}`

```typescript
type ResourceTypeId = `${string}/${string}/${string}`;
// Examples:
//   "azurerm/networking/virtual_network"
//   "aws/vpc/subnet"
//   "google/compute/instance"
```

### ResourceSchema

The core definition for a resource type. Drives palette, canvas, sidebar, HCL, and validation.

```typescript
interface ResourceSchema {
  readonly typeId: ResourceTypeId;
  readonly provider: ProviderId;
  readonly displayName: string;              // "Virtual Network"
  readonly category: string;                 // "networking"
  readonly description: string;              // Tooltip text
  readonly terraformType: string;            // "azurerm_virtual_network"
  readonly properties: ReadonlyArray<PropertySchema>;
  readonly handles: ReadonlyArray<HandleDefinition>;
  readonly supportsTags: boolean;
  readonly requiresResourceGroup: boolean;
}
```

### PropertySchema

Defines a single form field in the property sidebar. Also used for provider config forms.

```typescript
type PropertyFieldType =
  | 'string' | 'number' | 'boolean'
  | 'select' | 'multiselect'
  | 'cidr' | 'tags' | 'key-value-map'
  | 'array' | 'object'
  | 'reference';  // Reference to another resource on the diagram

interface PropertySchema {
  readonly key: string;                  // Machine key, e.g., "address_space"
  readonly label: string;                // Display label, e.g., "Address Space"
  readonly type: PropertyFieldType;
  readonly description?: string;         // Help text / tooltip
  readonly required: boolean;
  readonly defaultValue?: unknown;
  readonly placeholder?: string;

  // For 'select' / 'multiselect'
  readonly options?: ReadonlyArray<{ label: string; value: string }>;

  // For 'reference': which resource types can be referenced.
  // Values are stored in node.data.references (not properties) and flow
  // automatically through diagram-converter to HCL generators.
  readonly referenceTargetTypes?: ReadonlyArray<ResourceTypeId>;

  // For 'array': schema of each item
  readonly itemSchema?: PropertySchema;

  // For 'object': nested field schemas
  readonly nestedSchema?: ReadonlyArray<PropertySchema>;

  // Validation
  readonly validation?: PropertyValidation;

  // UI grouping and ordering
  readonly group?: string;               // Collapsible group heading
  readonly order?: number;               // Sort order within group

  // Conditional visibility — hides this property unless the condition is met.
  // `field` references another property key; `operator` compares its value.
  // Example: show NSG dropdown only when nsg_enabled is true:
  //   visibleWhen: { field: 'nsg_enabled', operator: 'truthy' }
  readonly visibleWhen?: {
    field: string;
    operator: 'eq' | 'neq' | 'in' | 'notIn' | 'truthy' | 'falsy';
    value?: unknown;
  };
}

interface PropertyValidation {
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly min?: number;
  readonly max?: number;
  readonly pattern?: string;
  readonly patternMessage?: string;
  readonly customValidator?: string;
}
```

### HandleDefinition

Connection points on a node. Determines which edges can attach.

```typescript
interface HandleDefinition {
  readonly id: string;                   // "plan-out"
  readonly type: 'source' | 'target';
  readonly position: 'top' | 'bottom' | 'left' | 'right';
  readonly acceptsTypes?: ReadonlyArray<ResourceTypeId>;
  readonly acceptsOutputs?: boolean;     // Accept connections from any dynamic out-* handle
  readonly label: string;                // Shown on hover
  readonly maxConnections?: number;      // undefined = unlimited
}
```

## Node Types

### ResourceNodeData

The data payload stored in each Svelte Flow node (`node.data`).

```typescript
interface ResourceNodeData {
  typeId: ResourceTypeId;
  properties: Record<string, unknown>;
  references: Record<string, string>;       // property key -> target node id
  terraformName: string;                    // e.g., "main"
  label: string;                            // Display label on node
  validationErrors: ValidationError[];
  deploymentStatus?: DeploymentStatus;
}

type DeploymentStatus =
  | 'pending'      // grey dot
  | 'creating'     // blue spinner
  | 'updating'     // yellow spinner
  | 'created'      // green dot
  | 'failed'       // red dot
  | 'destroyed';   // gone

interface ValidationError {
  readonly propertyKey: string;
  readonly message: string;
  readonly severity: 'error' | 'warning';
}
```

### ResourceNodeComponent

A Svelte component that renders a node on the canvas. Receives Svelte Flow's `NodeProps` with `ResourceNodeData`.

```typescript
import type { Component } from 'svelte';
import type { NodeProps } from '@xyflow/svelte';

type ResourceNodeProps = NodeProps<{ data: ResourceNodeData; type: string }>;
type ResourceNodeComponent = Component<ResourceNodeProps>;
```

### PropertyEditorComponent

Optional custom sidebar component. If not provided, the core renders a generic schema-driven editor.

```typescript
interface PropertyEditorProps {
  schema: ResourceSchema;
  properties: Record<string, unknown>;
  references: Record<string, string>;
  onPropertyChange: (key: string, value: unknown) => void;
  onReferenceChange: (key: string, targetInstanceId: string | null) => void;
  availableResources: Array<{
    instanceId: string;
    typeId: ResourceTypeId;
    label: string;
  }>;
}

type PropertyEditorComponent = Component<PropertyEditorProps>;
```

## HCL Types

### ResourceInstance

Represents a single resource on the diagram with its configured values. Passed to HCL generators.

```typescript
interface ResourceInstance {
  readonly instanceId: string;           // Svelte Flow node id
  readonly typeId: ResourceTypeId;
  readonly properties: Record<string, unknown>;
  readonly references: Record<string, string>;  // property key -> target instance id
  readonly terraformName: string;               // e.g., "main"
}
```

### HclGenerationContext

Passed to every HCL generator. Provides cross-resource lookups and variable registration.

```typescript
interface HclGenerationContext {
  getResource(instanceId: string): ResourceInstance | undefined;
  getTerraformAddress(instanceId: string): string | undefined;
  getAttributeReference(instanceId: string, attribute: string): string;
  addVariable(variable: TerraformVariable): void;
  addOutput(output: TerraformOutput): void;
  getProviderConfig(providerId: string): Record<string, unknown>;
  getResourceGroupExpression(): string;
  getLocationExpression(): string;
}
```

### HclGenerator

Implemented by plugins for each resource type. Produces HCL blocks from a resource instance.

```typescript
interface HclGenerator {
  readonly typeId: ResourceTypeId;
  generate(resource: ResourceInstance, context: HclGenerationContext): HclBlock[];
}
```

### HclBlock

A single block of generated Terraform HCL.

```typescript
interface HclBlock {
  readonly blockType: 'resource' | 'data' | 'locals' | 'variable' | 'output';
  readonly terraformType?: string;     // e.g., "azurerm_virtual_network"
  readonly name?: string;              // e.g., "main"
  readonly content: string;            // Raw HCL text
  readonly dependsOn?: string[];       // Terraform addresses this depends on
}
```

### TerraformVariable & TerraformOutput

```typescript
interface TerraformVariable {
  readonly name: string;
  readonly type: string;               // "string", "number", "list(string)", etc.
  readonly description: string;
  readonly defaultValue?: unknown;
  readonly sensitive?: boolean;
  readonly validation?: {
    condition: string;
    errorMessage: string;
  };
}

interface TerraformOutput {
  readonly name: string;
  readonly value: string;              // Terraform expression
  readonly description: string;
  readonly sensitive?: boolean;
}
```

## Connection Types

### ConnectionRule

Defines a valid edge between two resource types. Plugins provide these.

```typescript
interface ConnectionRule {
  readonly sourceType: ResourceTypeId;
  readonly sourceHandle: string;
  readonly targetType: ResourceTypeId;
  readonly targetHandle: string;
  readonly createsReference?: {
    side: 'source' | 'target';
    propertyKey: string;
  };
  readonly label?: string;
}
```

## Plugin Types

### InfraPlugin

The main plugin contract. Every plugin default-exports this.

```typescript
interface InfraPlugin {
  readonly id: string;                   // "@terrastudio/plugin-azure-networking"
  readonly name: string;                 // "Azure Networking"
  readonly version: string;              // "0.1.0"
  readonly providerId: ProviderId;

  readonly providerConfig?: ProviderConfig;
  readonly resourceTypes: ReadonlyMap<ResourceTypeId, ResourceTypeRegistration>;
  readonly connectionRules: ReadonlyArray<ConnectionRule>;
  readonly paletteCategories: ReadonlyArray<PaletteCategory>;

  onAllPluginsRegistered?(registry: PluginRegistryReader): void;
}
```

### ResourceTypeRegistration

Bundles everything the core needs for one resource type.

```typescript
interface ResourceTypeRegistration {
  readonly schema: ResourceSchema;
  readonly nodeComponent: ResourceNodeComponent;
  readonly propertyEditor?: PropertyEditorComponent;
  readonly hclGenerator: HclGenerator;
  readonly icon: IconDefinition;
}
```

### IconDefinition

```typescript
type IconDefinition =
  | { type: 'svg'; svg: string }
  | { type: 'component'; component: Component<{ size?: number; class?: string }> };
```

### PaletteCategory

```typescript
interface PaletteCategory {
  readonly id: string;
  readonly label: string;
  readonly icon?: IconDefinition;
  readonly order: number;
}
```

### PluginRegistryReader

Read-only view passed to plugins during `onAllPluginsRegistered`.

```typescript
interface PluginRegistryReader {
  getResourceTypeIds(): ReadonlyArray<ResourceTypeId>;
  getResourceSchema(typeId: ResourceTypeId): ResourceSchema | undefined;
  getProviderIds(): ReadonlyArray<ProviderId>;
  hasResourceType(typeId: ResourceTypeId): boolean;
}
```

## Related Docs

- [Plugin System](plugin-system.md) - How plugins use these interfaces
- [HCL Generation](hcl-generation.md) - How HclGenerator and the pipeline work
- [Architecture](architecture.md) - High-level overview
