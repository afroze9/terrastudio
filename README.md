# TerraStudio

Visual infrastructure diagram builder that generates and executes Terraform. Drag-and-drop Azure resources onto a canvas, configure them visually, and export production-ready Terraform code.

## Tech Stack

- **Desktop**: Tauri 2 (Rust backend)
- **Frontend**: Svelte 5 + SvelteKit (SPA mode) + TypeScript
- **Diagram**: @xyflow/svelte (Svelte Flow)
- **Styling**: Tailwind CSS 4 + bits-ui (headless components)
- **Build**: Vite 6 + pnpm workspaces + Turborepo
- **Output**: Raw HCL strings (Terraform files)

## Monorepo Layout

```
packages/types/                     # Shared TypeScript interfaces
packages/core/                      # Diagram engine, HCL pipeline, Terraform bridge
packages/plugin-azure-networking/   # VNet, Subnet, NSG
packages/plugin-azure-compute/      # Resource Group, VM
apps/desktop/                       # Tauri 2 desktop app
```

## Getting Started

```bash
pnpm install              # Install all dependencies
pnpm build                # Build all packages
pnpm dev                  # Start dev server
pnpm tauri dev            # Start Tauri desktop app in dev mode
```

## Architecture

**Plugin-based**: Core is provider-agnostic. Azure/AWS/GCP resources come from plugin packages.

**Schema-driven**: Each resource type has one schema file that drives the palette icon, canvas node, sidebar form, HCL generation, and validation. Adding a resource = adding one schema + node + generator file to a plugin.

**Data flow**: Palette → Canvas (Svelte Flow) → Sidebar (edit properties) → HCL Generator → Terraform CLI (Rust backend)

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).
