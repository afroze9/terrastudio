# TerraStudio

Visual infrastructure diagram builder that generates and executes Terraform. Desktop app built with Tauri 2 + Svelte 5 + Svelte Flow.

## Tech Stack

- **Desktop**: Tauri 2 (Rust backend)
- **Frontend**: Svelte 5 + SvelteKit (SPA mode) + TypeScript
- **Diagram**: @xyflow/svelte (Svelte Flow)
- **Styling**: Tailwind CSS 4 + bits-ui (headless components)
- **Build**: Vite 6 + pnpm workspaces + Turborepo
- **Output**: Raw HCL strings (Terraform files)

## Monorepo Layout

```
packages/types/                     # @terrastudio/types - shared interfaces (the contract)
packages/core/                      # @terrastudio/core - diagram engine, HCL pipeline, terraform bridge
packages/plugin-azure-networking/   # @terrastudio/plugin-azure-networking - VNet, Subnet, NSG
packages/plugin-azure-compute/      # @terrastudio/plugin-azure-compute - RG, VM, App Service, Key Vault
packages/plugin-azure-storage/      # @terrastudio/plugin-azure-storage - Storage Account, Blob
apps/desktop/                       # Tauri 2 desktop app (wires core + plugins)
```

## Key Commands

```bash
pnpm install              # Install all dependencies
pnpm build                # Build all packages (types -> core -> plugins -> app)
pnpm dev                  # Start dev server (turborepo parallel)
pnpm tauri dev            # Start Tauri desktop app in dev mode
pnpm typecheck            # TypeScript checking across all packages
pnpm lint                 # Lint all packages
```

## Architecture

**Plugin-based**: Core is provider-agnostic. Azure/AWS/GCP resources come from plugin packages.

**Schema-driven**: Each resource type has one schema file that drives the palette icon, canvas node, sidebar form, HCL generation, and validation. Adding a resource = adding one schema + node + generator file to a plugin.

**Data flow**: Palette -> Canvas (Svelte Flow) -> Sidebar (edit properties) -> HCL Generator -> Terraform CLI (Rust backend) -> Deployment status (green/grey dots on nodes)

## Key Patterns

### Plugin structure
Every plugin default-exports an `InfraPlugin` object with `resourceTypes` (Map), `connectionRules`, `paletteCategories`, and optional `providerConfig`.

### Resource type registration
Each resource bundles: `schema.ts` + `node.svelte` + `hcl-generator.ts` + `icon.ts` -> `index.ts` (ResourceTypeRegistration)

### ResourceTypeId format
`{provider}/{category}/{resource}` e.g. `azurerm/networking/virtual_network`

### Svelte Flow node types
The `nodeTypes` map uses ResourceTypeId as keys. Built dynamically from the PluginRegistry.

### HCL generators
Each returns `HclBlock[]` with raw HCL strings. The core pipeline assembles blocks into terraform.tf, providers.tf, main.tf, variables.tf, outputs.tf, locals.tf.

### Resource outputs and bindings
Resources declare `outputs` in their schema (e.g., connection strings, IPs). Users toggle outputs on/off in the sidebar, creating dynamic `out-{key}` source handles. Target handles with `acceptsOutputs: true` (e.g., Key Vault's `secret-in`) accept connections from any dynamic output handle — no per-source-type `ConnectionRule` needed. The `EdgeRuleValidator` synthesizes rules; wildcard `BindingHclGenerator` (no `sourceType`) generates the binding Terraform resource. Bootstrap collects `OutputAcceptingHandle[]` from schemas and passes them to the validator.

### Export + doc generation
Core provides image export (PNG/SVG/clipboard) and a documentation generator that walks the diagram graph to produce Markdown architecture docs with resource inventory, network topology, Mermaid dependency graphs, and variable reference. Plugins can contribute doc sections.

### State management
Svelte 5 runes (`$state`, `$derived`). No stores library. Diagram state in `diagram.svelte.ts`.

## Conventions

- npm scope: `@terrastudio/`
- Plugin naming: `@terrastudio/plugin-{provider}-{category}` (e.g., `plugin-azure-networking`)
- Resource directories: `packages/plugin-*/src/resources/{resource-name}/`
- Connection rules: `packages/plugin-*/src/connections/rules.ts`
- Plugins are statically imported in `apps/desktop/src/lib/bootstrap.ts`
- Use Mermaid diagrams in markdown documentation
- Types package has zero runtime dependencies

## Adding New Resources

When adding a new Azure (or any provider) resource, determine the following before writing code:

### 1. Container or leaf?
- **Container** (`isContainer: true`): Renders as a resizable box that other nodes can be placed inside (e.g., Resource Group, VNet, Subnet). Uses `ContainerResourceNode.svelte`.
- **Leaf** (`isContainer` omitted/false): Renders as a compact card node (e.g., VM, NSG, Storage Account). Uses `DefaultResourceNode.svelte`.

### 2. Containment requirements (`canBeChildOf`)
Does this resource **must** live inside a specific container? If so, set `canBeChildOf: ['azurerm/.../parent_type']`. Examples:
- Subnet must be inside a VNet
- VM must be inside a Subnet
- Most resources must be inside a Resource Group

If it has a containment parent, also set `parentReference: { propertyKey: '...' }` so HCL generation can derive the parent reference from `parentId`. The `propertyKey` should match the Terraform argument name (e.g., `'virtual_network_name'` for Subnet, `'subnet_id'` for VM).

### 3. Association edges (handles + connection rules)
Does this resource need a **non-containment** relationship with another resource? These are drawn as edges on the canvas. Examples:
- NSG associates with Subnet or VM (not containment — NSG lives in RG, not inside Subnet)
- App Service references an App Service Plan

For each association:
- Add a **handle** on both sides (source handle on the provider, target handle on the consumer)
- Add a **connection rule** in the plugin's `connections/rules.ts`
- If the edge creates a Terraform reference, set `createsReference: { side, propertyKey }` on the rule

**Rule of thumb**: If the relationship is parent-child (one is visually inside the other), use `canBeChildOf` + `parentReference`. If the relationship is peer-to-peer or cross-container, use handles + edges.

### 4. Resource outputs and dynamic handles
Resources can expose Terraform output attributes (e.g., connection strings, IPs) via the `outputs` array in the schema. Each output has a `key`, `label`, `terraformAttribute`, and optional `sensitive` flag. Users toggle outputs on/off in the sidebar; enabled outputs create dynamic source handles (`out-{key}`) on the node.

**Dynamic output handles**: When a user enables an output, a source handle appears on the right side of the node. The handle ID follows the convention `out-{output.key}`. The `DefaultResourceNode` and `ContainerResourceNode` components manage these dynamically using `useUpdateNodeInternals()` from SvelteFlow (NOT `useSvelteFlow()` — they're different hooks).

**`acceptsOutputs` pattern**: Target handles can set `acceptsOutputs: true` to accept connections from **any** dynamic output handle without per-source-type connection rules. The `EdgeRuleValidator` synthesizes rules dynamically — no explicit `ConnectionRule` entries needed. Currently used by Key Vault's `secret-in` handle. Use this for any "data sink" handle that should accept outputs from arbitrary resource types.

**Binding generators**: When an `acceptsOutputs` edge creates a Terraform resource (e.g., `azurerm_key_vault_secret`), register a `BindingHclGenerator` with `sourceType: undefined` (wildcard) on the plugin. The core pipeline matches it for any source resource type.

**When to use `acceptsOutputs` vs `acceptsTypes`**:
- `acceptsTypes`: For structural 1:1 relationships (NSG→Subnet, Plan→App Service). The target knows exactly which source types are valid.
- `acceptsOutputs`: For data-flow relationships where many different source types can contribute data (any resource → Key Vault secret). The target doesn't care about source type, only that it has enabled outputs.

### 5. Other schema fields
- `requiresResourceGroup`: Does Terraform need `resource_group_name`? Almost always `true` for Azure resources.
- `supportsTags`: Does the Azure resource accept a `tags` block?
- `terraformType`: The exact Terraform resource type string. Watch for OS variants (e.g., `azurerm_linux_web_app` vs `azurerm_windows_web_app`).
- `containerStyle`: Only for containers — border color, style, background, header color, radius.

### 6. HCL generator considerations
- Use `context.getResourceGroupExpression()` and `context.getLocationExpression()` for RG/location references.
- Use `resource.references[key]` + `context.getAttributeReference(ref, attr)` for cross-resource references.
- If extra data sources are needed (e.g., `data.azurerm_client_config` for Key Vault), emit them as additional `HclBlock` entries with `blockType: 'data'`.
- Set `dependsOn` on the HclBlock when the resource explicitly depends on another.
- For binding generators (`BindingHclGenerator`): set `sourceType` to a specific type for targeted bindings, or `undefined` for wildcard (any source). Register in the plugin's `bindingGenerators` array.

### 7. File checklist
For each new resource, create these files in the plugin's `src/resources/{resource-name}/`:
- `schema.ts` — ResourceSchema definition
- `hcl-generator.ts` — HclGenerator implementation
- `index.ts` — ResourceTypeRegistration bundle
- `icon.ts` — (optional) IconDefinition with inline SVG

Then register it in the plugin's `src/index.ts` resourceTypes Map and add its category to `paletteCategories` if new.

## Documentation

Detailed architecture docs in `docs/`:
- [architecture.md](docs/architecture.md) - System overview, tech stack, data flow, UI layout
- [plugin-system.md](docs/plugin-system.md) - Plugin contract, registration, how to create plugins
- [type-interfaces.md](docs/type-interfaces.md) - All TypeScript interfaces
- [hcl-generation.md](docs/hcl-generation.md) - HCL pipeline, dependency resolution, variable extraction
- [project-structure.md](docs/project-structure.md) - Complete directory tree
- [implementation-roadmap.md](docs/implementation-roadmap.md) - 10-phase build plan
