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
packages/plugin-azure-compute/      # @terrastudio/plugin-azure-compute - VM, VMSS, App Service
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

## Documentation

Detailed architecture docs in `docs/`:
- [architecture.md](docs/architecture.md) - System overview, tech stack, data flow, UI layout
- [plugin-system.md](docs/plugin-system.md) - Plugin contract, registration, how to create plugins
- [type-interfaces.md](docs/type-interfaces.md) - All TypeScript interfaces
- [hcl-generation.md](docs/hcl-generation.md) - HCL pipeline, dependency resolution, variable extraction
- [project-structure.md](docs/project-structure.md) - Complete directory tree
- [implementation-roadmap.md](docs/implementation-roadmap.md) - 10-phase build plan
