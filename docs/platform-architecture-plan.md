# Platform Architecture Plan

> **Status**: Planning — not yet started (as of 2026-03-15)
>
> This document captures the agreed direction for evolving TerraStudio from a single Tauri
> desktop app into a multi-platform product: desktop app, CLI, and (later) web app — all
> sharing the same core domain logic.

---

## Motivation

### Problems with the current MCP approach

The MCP implementation requires the desktop app to be running. Every mutation flows through:

```
Claude → MCP sidecar → WebSocket → Rust bridge → Tauri events → Svelte store
```

This creates several pain points:
- The app must be open for any programmatic interaction
- HCL generation has a 15-second timeout waiting for a frontend sync
- The bridge code (~2000 lines of Rust + ~1000 lines of TS) duplicates logic already in core
- It cannot be used in CI, scripting, or headless environments

### The right mental model

TerraStudio is fundamentally a **project file editor + HCL compiler**. The GUI is one way
to interact with it. A CLI should be another. A web app could be a third. All of them
should operate on the same `.tstudio` project files using the same business logic — with
no dependency on a running desktop app.

---

## Target Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        RENDERING LAYER                              │
│                                                                     │
│   apps/desktop/   Tauri 2 + Svelte 5 shell                         │
│   apps/web/       SvelteKit (future) — design + HCL export only    │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ imports
┌───────────────────────────────▼─────────────────────────────────────┐
│                        UI LOGIC LAYER                               │
│                                                                     │
│   packages/ui/    Svelte components — canvas, panels, palette       │
│                   Shared between desktop and web apps               │
│                   No Tauri calls — all I/O goes through IPlatform   │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ imports
┌───────────────────────────────▼─────────────────────────────────────┐
│                     PLATFORM ADAPTER LAYER                          │
│                                                                     │
│   packages/platform-tauri/   wraps Tauri invoke + fs commands       │
│   packages/platform-node/    wraps Node.js fs/promises              │
│   packages/platform-web/     wraps fetch + OPFS / IndexedDB        │
│                                                                     │
│   All implement a common IPlatform interface                        │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ imports
┌───────────────────────────────▼─────────────────────────────────────┐
│                      DOMAIN LOGIC LAYER                             │
│                                                                     │
│   @terrastudio/core          HCL pipeline, validators, naming       │
│   @terrastudio/types         TypeScript interfaces (zero deps)      │
│   @terrastudio/plugin-*/     Resource schemas + HCL generators      │
│                                                                     │
│   NEW: @terrastudio/project  In-memory project model + mutations    │
│   NEW: packages/cli          CLI entry point (tstudio command)      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## New Packages

### `@terrastudio/project`

Pure TypeScript — no I/O, no Tauri, no Node.js. Defines the **in-memory project model**
and all operations on it. Currently this logic is split between `project-service.ts`,
`diagram.svelte.ts`, and `diagram-converter.ts` inside the desktop app.

**Responsibilities:**
- Parse a raw diagram JSON snapshot into a typed `Project` object
- All diagram mutations: add/update/remove nodes, connect/disconnect edges, reparent, resize
- Module operations: create, delete, rename, collapse, convert to template, instantiate
- Validate the project (edge rules, containment, naming conflicts)
- Generate HCL by delegating to `@terrastudio/core`'s `HclPipeline`
- Produce a serializable snapshot for writing back to disk

**What it does NOT do:**
- Read or write files (that's the platform adapter's job)
- Render anything
- Know about Tauri, Node.js, or browsers

**Rough API:**
```typescript
// Load
const project = Project.fromSnapshot(diagramJson, projectConfig, registry);

// Mutate
project.addNode({ typeId, position, parentId, properties });
project.updateNode(id, { properties });
project.removeNode(id);
project.connectNodes(sourceId, targetId, sourceHandle, targetHandle);

// Validate
const errors = project.validate();

// Generate
const files = await project.generateHcl();

// Serialize
const snapshot = project.toSnapshot(); // write back to disk
```

### `packages/cli`

Node.js CLI tool. Entry point for the `tstudio` command.

**Uses:**
- `@terrastudio/project` for all domain operations
- `platform-node` for file I/O
- `commander.js` for argument parsing

**Does not use:**
- Tauri
- Any browser APIs
- A running desktop app

**Commands (planned):**
```
tstudio resource list   <project-path> [--type <typeId>] [--format json|table]
tstudio resource add    <project-path> <typeId> [--name <slug>] [--parent <id>]
tstudio resource update <project-path> <id> --set <key>=<value> ...
tstudio resource remove <project-path> <id>
tstudio resource connect <project-path> <sourceId> <targetId>

tstudio hcl generate    <project-path> [--out <dir>]
tstudio hcl show        <project-path> [--file main.tf]

tstudio project new     <path> [--provider azurerm]
tstudio project validate <project-path>
tstudio project info    <project-path>
```

### `IPlatform` interface

A small interface that abstracts file I/O and (optionally) subprocess execution.
Lives in `@terrastudio/types` or a dedicated `@terrastudio/platform` package.

```typescript
interface IPlatform {
  // File I/O
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  readDir(path: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;

  // Optional — only implemented by desktop + CLI
  runProcess?(
    command: string,
    args: string[],
    cwd: string,
  ): AsyncIterable<{ stream: 'stdout' | 'stderr'; line: string }>;
}
```

---

## What Gets Removed

### MCP server (`packages/mcp-server/`)
Entire package deleted. The CLI replaces all use cases that don't require a live canvas.

### Rust MCP bridge (`apps/desktop/src-tauri/src/mcp/`)
`server.rs`, `commands.rs`, `manifest.rs` — deleted. The ~2000-line Rust command handler
was only needed to proxy mutations to the Svelte store. Once `@terrastudio/project` owns
mutations and the CLI operates on files directly, this bridge has no purpose.

### Frontend MCP glue (`apps/desktop/src/lib/mcp/`)
`bridge-listener.ts`, `diagram-sync.svelte.ts`, `mcp-status.svelte.ts` — deleted.
The debounced 100ms sync and the 15-second HCL generation timeout go away entirely.

---

## Feature Matrix by Platform

| Feature | Desktop | CLI | Web (future) |
|---|:---:|:---:|:---:|
| Visual diagram editing | ✅ | ❌ | ✅ |
| HCL generation | ✅ | ✅ | ✅ |
| `terraform init / plan / apply` | ✅ | ✅ | ❌ |
| Save/load `.tstudio` files | ✅ native | ✅ path args | ⚠️ download/OPFS |
| Cost estimation | ✅ | ✅ | ✅ (HTTP) |
| Secrets / OS keychain | ✅ | ✅ env vars | ❌ or backend |
| Scripting / CI | ❌ | ✅ | ❌ |
| No install required | ❌ | ❌ | ✅ |

The web app is a **design and export** tool — diagram editor + HCL preview, no Terraform
execution. That is still a strong standalone use case.

---

## Migration Phases

These phases are sequential. Each is independently shippable and does not break the
desktop app.

### Phase A — Extract `@terrastudio/project`

Pull project and diagram mutation logic out of the desktop app into a pure package.

**Moves:**
- `project-service.ts` → `@terrastudio/project` (I/O stripped out, pure model operations)
- `diagram-converter.ts` → `@terrastudio/project`
- Diagram mutation helpers from `diagram.svelte.ts` → `@terrastudio/project`
  (the Svelte store keeps `$state` and reactivity; the pure mutations become library calls)

**Desktop app change:** calls `@terrastudio/project` instead of doing it inline.
No user-visible change.

**Unblocks:** Phase B (CLI needs this).

### Phase B — Delete MCP, build `packages/cli`

- Delete `packages/mcp-server/`, `apps/desktop/src-tauri/src/mcp/`, `apps/desktop/src/lib/mcp/`
- Create `packages/cli` with `commander.js` and the `tstudio` binary
- Wire `@terrastudio/project` + `platform-node` + all Azure plugins

**Deliverable:** `tstudio` CLI that works on `.tstudio` files with no running app.

### Phase C — Define `IPlatform`, create adapters

Formalize the I/O boundary that Phase A informally introduced.

- Add `IPlatform` to `@terrastudio/types`
- Create `packages/platform-tauri` (wraps current Tauri invoke calls)
- Create `packages/platform-node` (wraps Node.js fs — used by CLI from Phase B)
- Desktop app imports `platform-tauri` and passes it down; no direct `invoke` calls in
  components or services

**Unblocks:** Phase D (UI package needs IPlatform to be decoupled from Tauri).

### Phase D — Extract `packages/ui`

Move Svelte components out of `apps/desktop/src/lib/` into a shared package.

- Components call `IPlatform` for I/O (never `invoke` directly)
- Canvas, properties panel, palette, dialogs — all move to `packages/ui`
- `apps/desktop` becomes a thin shell: init Tauri platform adapter, mount UI, handle
  OS-level concerns (system tray, window management, auto-update)

**Unblocks:** Phase E.

### Phase E — `apps/web` (future)

New SvelteKit app:
- Imports `packages/ui` (same components as desktop)
- Wires `platform-web` (fetch + OPFS)
- No Terraform execution
- Can be deployed as SaaS or self-hosted

At this point the UI package and desktop app have already proven the pattern. Phase E is
mostly configuration and platform-web implementation.

---

## Notes

- **CLI name**: `tstudio` (avoids conflict with the `ts` TypeScript compiler alias)
- **Secrets in CLI**: read from environment variables or a `.env` file alongside the project;
  not from the OS keychain (that stays desktop-only)
- **No version bump needed for Phase A** — it's a pure refactor with no user-visible change
- **Phases C–E are optional** from a CLI perspective; they are only needed for the web app
- The existing `@terrastudio/core` package does not change during any of these phases —
  it is already correctly positioned at the bottom of the dependency graph
