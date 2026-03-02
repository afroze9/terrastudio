# HCL Generation

## Overview

The HCL generation system transforms a visual diagram into valid Terraform configuration files. The **core** provides the pipeline orchestrator, and **plugins** provide per-resource-type generators.

## Pipeline Architecture

```mermaid
flowchart TB
    subgraph Input
        N[Diagram Nodes] --> P[HCL Pipeline]
        E[Diagram Edges] --> P
        PC[Project Config] --> P
    end

    subgraph Pipeline ["HCL Pipeline (core)"]
        P --> RM[Build Resource Map]
        RM --> CTX[Create Generation Context]
        CTX --> GEN["Call plugin generators<br/>for each resource"]
        GEN --> DEP[Dependency Graph Sort]
        DEP --> ASM[Assemble Output Files]
    end

    subgraph Generators ["Plugin Generators"]
        GEN -->|"typeId lookup"| REG[Plugin Registry]
        REG -->|"HclGenerator"| G1[VNet Generator]
        REG -->|"HclGenerator"| G2[Subnet Generator]
        REG -->|"HclGenerator"| G3[VM Generator]
    end

    subgraph Output
        ASM --> TF[terraform.tf]
        ASM --> PROV[providers.tf]
        ASM --> MAIN[main.tf]
        ASM --> VARS[variables.tf]
        ASM --> OUT[outputs.tf]
        ASM --> LOC[locals.tf]
    end
```

## Output Format: Raw HCL Strings

Each `HclGenerator.generate()` returns raw HCL text blocks. This is deliberately simple:

- Generators are hand-written per resource type - they know the exact output shape
- No need for an HCL AST library (unnecessary complexity)
- `terraform fmt` (invoked via Tauri) normalizes formatting after generation
- Human-readable output that users can inspect and hand-edit

## Generation Context

The `HclGenerationContext` is created by the core pipeline and passed to every plugin generator. It provides:

```mermaid
classDiagram
    class HclGenerationContext {
        +getResource(instanceId) ResourceInstance
        +getTerraformAddress(instanceId) string
        +getAttributeReference(instanceId, attr) string
        +addVariable(variable) void
        +addOutput(output) void
        +getProviderConfig(providerId) Record
        +getResourceGroupExpression() string
        +getLocationExpression() string
    }
```

- **Cross-resource references**: A subnet generator can look up its parent VNet's terraform address to produce `azurerm_virtual_network.main.name`
- **Variable registration**: Any generator can register a variable (e.g., when a user toggles a property to become a tfvar)
- **Output registration**: Generators can register outputs for important attributes
- **Provider config access**: Generators can read provider-level settings

## Dependency Resolution

References between resources are resolved through three mechanisms:

### Source 1: Containment References (parentId)

When a node is visually nested inside a container, `deriveParentReferences()` uses the child's `parentReference.propertyKey` to set the reference automatically:

```mermaid
flowchart LR
    subgraph Diagram
        A["VNet container"] -->|"parentId"| B["Subnet node"]
    end

    subgraph Schema
        S["subnet.parentReference:<br/>  propertyKey: 'virtual_network_name'"]
    end

    subgraph Result
        R["subnet.references = {<br/>  virtual_network_name: vnet-node-id<br/>}"]
    end

    Diagram --> Schema --> Result
```

No edges or connection rules needed — the visual nesting drives the reference.

### Source 2: Edge-to-Reference Mapping

For non-containment associations (e.g., App Service Plan → App Service), edges on the diagram map to references via `ConnectionRule`:

```mermaid
flowchart LR
    subgraph Diagram
        A["Plan node"] -->|"edge"| B["App Service node"]
    end

    subgraph ConnectionRule
        CR["sourceType: .../app_service_plan<br/>targetType: .../app_service<br/>createsReference:<br/>  side: target<br/>  propertyKey: service_plan_id"]
    end

    subgraph Result
        R["appService.references = {<br/>  service_plan_id: plan-node-id<br/>}"]
    end

    Diagram --> ConnectionRule --> Result
```

When an edge is created, the matching `ConnectionRule` determines which property on which side gets set as a reference.

### Source 3: Property-Based References

Some associations are configured via the property sidebar instead of edges. The resource schema declares a `reference` property type with `referenceTargetTypes`, and the user selects the target from a dropdown. Values are stored directly in `node.data.references` and flow through to HCL generators automatically.

Example: NSG association on Subnet/VM uses `nsg_id` reference property with a `visibleWhen` conditional toggle, instead of handles + connection rules.

### Step 2: Reference Resolution in Generators

Inside a generator, the context resolves references to Terraform expressions:

```typescript
// In subnet HCL generator:
const vnetRef = context.getAttributeReference(
  resource.references['virtual_network_name'],
  'name'
);
// Returns: "azurerm_virtual_network.main.name"
```

### Step 3: Topological Sort

Generated `HclBlock`s declare their dependencies via `dependsOn`. The `DependencyGraph` performs a topological sort so blocks are emitted in valid order:

```typescript
class DependencyGraph {
  constructor(blocks: HclBlock[]);
  topologicalSort(): HclBlock[];
}
```

## Variable Extraction

Any property field can be toggled to become a Terraform variable:

```mermaid
sequenceDiagram
    participant User
    participant Sidebar
    participant NodeData
    participant Generator
    participant Context
    participant Output

    User->>Sidebar: Toggle "Name" to variable
    Sidebar->>NodeData: variableBindings.name = "vnet_name"
    Note over Generator: During HCL generation
    Generator->>Context: addVariable({ name: "vnet_name", type: "string", ... })
    Generator->>Output: name = var.vnet_name (instead of literal)
    Context->>Output: variable "vnet_name" { ... } in variables.tf
```

The generator checks if a property has a variable binding and emits `var.{name}` instead of the literal value. The context collects all variables and includes them in `variables.tf`.

## Generated File Structure

The pipeline produces these files:

| File | Contents |
|---|---|
| `terraform.tf` | `required_version`, `required_providers`, optional backend config |
| `providers.tf` | `provider "azurerm" { ... }` blocks for each active provider |
| `main.tf` | All `resource` and `data` blocks, topologically sorted |
| `variables.tf` | All `variable` blocks (from user-toggled properties + standard vars) |
| `outputs.tf` | All `output` blocks (from generators) |
| `locals.tf` | Common tags, shared expressions |

## Example: VNet Schema to Generated HCL

### Input: Diagram Node Data

```json
{
  "typeId": "azurerm/networking/virtual_network",
  "terraformName": "main",
  "properties": {
    "name": "my-vnet",
    "address_space": ["10.0.0.0/16"]
  },
  "references": {}
}
```

### Plugin Generator

```typescript
const vnetHclGenerator: HclGenerator = {
  typeId: 'azurerm/networking/virtual_network',

  generate(resource, context): HclBlock[] {
    const props = resource.properties;
    const rgExpr = context.getResourceGroupExpression();
    const locExpr = context.getLocationExpression();
    const addrList = (props.address_space as string[]).map(a => `"${a}"`).join(', ');

    return [{
      blockType: 'resource',
      terraformType: 'azurerm_virtual_network',
      name: resource.terraformName,
      content: [
        `resource "azurerm_virtual_network" "${resource.terraformName}" {`,
        `  name                = "${props.name}"`,
        `  resource_group_name = ${rgExpr}`,
        `  location            = ${locExpr}`,
        `  address_space       = [${addrList}]`,
        ``,
        `  tags = local.common_tags`,
        `}`,
      ].join('\n'),
    }];
  },
};
```

### Output: main.tf (excerpt)

```hcl
resource "azurerm_virtual_network" "main" {
  name                = "my-vnet"
  resource_group_name = var.resource_group_name
  location            = var.location
  address_space       = ["10.0.0.0/16"]

  tags = local.common_tags
}
```

## Project Config

The `ProjectConfig` controls global generation settings:

```typescript
interface ProjectConfig {
  providerConfigs: Record<ProviderId, Record<string, unknown>>;
  resourceGroupName: string;
  resourceGroupAsVariable: boolean;
  location: string;
  locationAsVariable: boolean;
  commonTags: Record<string, string>;
  backend?: {
    type: 'azurerm' | 'local' | 's3' | 'gcs';
    config: Record<string, string>;
  };
}
```

When `resourceGroupAsVariable` is true, the pipeline automatically adds a `var.resource_group_name` variable and all generators use `var.resource_group_name` instead of a literal string.

## Module-Aware Pipeline

When resources are assigned to modules (via `moduleId` on `ResourceNodeData`), the pipeline switches from flat generation to module-aware generation.

### Resource Partitioning

The pipeline partitions `realResources` by `moduleId`:

```mermaid
flowchart TB
    ALL["All real resources"] --> PART["Partition by moduleId"]
    PART --> ROOT["Root resources<br/><i>no moduleId</i>"]
    PART --> MOD1["Module A resources"]
    PART --> MOD2["Module B resources"]

    ROOT --> RCTX["Root HclGenerationContext"]
    MOD1 --> MCTX1["ModuleHclContext (A)"]
    MOD2 --> MCTX2["ModuleHclContext (B)"]
```

If no modules contain resources, the pipeline falls back to the original flat generation path (unchanged behavior).

### ModuleHclContext

Each module gets its own `ModuleHclContext` (implements `HclGenerationContext`). It provides the same interface as the root context but scopes references to module-internal resources and auto-wires cross-boundary references:

- **Intra-module reference** (both resources in the same module): resolved directly, e.g., `azurerm_virtual_network.main.name`
- **Cross-boundary outbound reference** (module resource references something outside):
  1. Replaces with `var.{name}` inside the module
  2. Registers a `TerraformVariable` on the module's variable collector
  3. Records the real expression (e.g., `azurerm_resource_group.main.name`) for the root `module {}` block

Cross-boundary inbound references (root resources referencing module internals) are handled by the root context, which auto-registers `output` declarations on the module and returns `module.{name}.{output_name}`.

### getPropertyExpression()

Both the root context and `ModuleHclContext` implement `getPropertyExpression(resource, key, value, options?)`:

```typescript
context.getPropertyExpression(resource, 'name', props.name);
// If mode is 'literal': returns '"my-vnet"'
// If mode is 'variable': registers var.main_name, returns 'var.main_name'
```

The method checks `resource.variableOverrides?.[key]`:
- **`'literal'`** (default): formats the value as an HCL literal (handles strings, numbers, booleans, arrays)
- **`'variable'`**: registers a `TerraformVariable` (with auto-derived name, type, and description) and returns `var.{name}`

Options allow overriding the variable name, type, description, and sensitivity.

### Variable Collector Integration

The variable collector gathers variables from two sources in module-aware mode:
1. **User-toggled property variables** — via `getPropertyExpression()` when `variableOverrides[key] === 'variable'`
2. **Cross-boundary reference variables** — auto-created by `ModuleHclContext` when a module resource references an external resource

For template modules with instances, user-toggled variables are passed through to each `module {}` block as `var.{name}` (so the root must also declare them). Instance-specific `variableValues` override the passed-through expression with a literal.

### Template Instance Generation

When a `ModuleDefinition` has `isTemplate: true`:

```mermaid
flowchart LR
    TMPL["Module template<br/><i>isTemplate: true</i>"] --> DIR["modules/{name}/<br/>main.tf, variables.tf,<br/>outputs.tf, locals.tf"]
    TMPL --> INST1["ModuleInstance 'net_dev'"]
    TMPL --> INST2["ModuleInstance 'net_prod'"]
    INST1 --> BLK1["module 'net_dev' {<br/>  source = './modules/{name}'<br/>  name = 'dev-vnet'<br/>}"]
    INST2 --> BLK2["module 'net_prod' {<br/>  source = './modules/{name}'<br/>  name = 'prod-vnet'<br/>}"]
```

One module source directory is generated. Each `ModuleInstance` produces a `module {}` block in root `main.tf` with:
- `source = "./modules/{template.name}"`
- Cross-boundary input values from the wiring
- Per-instance `variableValues` overrides (literal values replace the default expressions)

Non-template modules produce a single `module {}` block.

### Generated File Structure for Modules

| Path | Contents |
|---|---|
| `modules/{name}/main.tf` | Resource and data blocks for the module's members |
| `modules/{name}/variables.tf` | Input variables (cross-boundary + user-toggled) |
| `modules/{name}/outputs.tf` | Output declarations (cross-boundary + generator-registered) |
| `modules/{name}/locals.tf` | Common tags (replicated from root for generator compatibility) |

Root-level files (`main.tf`, `variables.tf`, etc.) contain root resources plus `module {}` blocks.

## Related Docs

- [Type Interfaces](type-interfaces.md) - HclGenerator, HclBlock, HclGenerationContext definitions
- [Plugin System](plugin-system.md) - How plugins register HCL generators
- [Architecture](architecture.md) - Where HCL generation fits in the data flow
