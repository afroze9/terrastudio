# Smart Resource Duplication Specification

**Spec ID**: SPEC-001
**Status**: Draft
**Created**: 2026-03-07
**PRD Source**: Feature request — Smart Resource Duplication
**Author**: AI Spec Writer

## 1. Overview

TerraStudio currently supports duplication via `Ctrl+D`, which internally calls `copyNodes()` followed immediately by `pasteNodes()`. The paste operation generates new node IDs and unique Terraform names, but labels are suffixed with "(copy)" / "(copy 2)" — a pattern borrowed from general-purpose clipboard semantics. For infrastructure diagrams, this is unnatural: engineers think in numbered series ("web-server-1", "web-server-2"), not copy suffixes.

This specification upgrades the duplication pipeline to be "smart": labels gain incrementing numeric suffixes, Terraform names are derived from the new label, external references are preserved, internal references are remapped, and multi-select duplication preserves the edge topology within the copied set. The keyboard shortcut (`Ctrl+D`) and context menu "Duplicate" entry are enhanced in place — no new keyboard binding is introduced.

The change is entirely within `DiagramStore` (a new `duplicateNodes()` method) and `DnDFlow.svelte` / `Canvas.svelte` (two call-site updates). The existing `copyNodes()` / `pasteNodes()` path for `Ctrl+C` / `Ctrl+V` is left untouched.

## 2. Goals & Non-Goals

### Goals

- Replace the "(copy)" label suffix with an incrementing numeric suffix when duplicating (e.g., "web-server-1" → "web-server-2"; "db" → "db-2").
- Derive the new Terraform name from the new label rather than appending `_2` blindly (e.g., label "web-server-2" → terraform name "web_server_2").
- Keep duplicated nodes inside the same parent container as the originals, offset by +30 px on both axes.
- For multi-select duplication, preserve edges whose both endpoints are within the duplicated set and remap them to the new node IDs.
- Preserve edges/references to nodes outside the duplicated set without modification.
- Remap `data.references` entries that point to nodes inside the duplicated set to their new counterparts; keep references to nodes outside the set unchanged.
- Deep-clone `data.properties`, `data.variableOverrides`, `data.enabledOutputs`, `data.connectionPoints`, and `data.handlePositions` from the original to the duplicate.
- Leave `deploymentStatus` and `validationErrors` cleared on the duplicate (fresh resource, not yet deployed or validated).
- Keep `referenceEdgeOverrides` off the duplicate (visual customizations on the original do not carry over).
- The feature works for containers with children: children are included automatically (same as existing `copyNodes()` child-collection logic).
- Undo/redo: one undo step reverts the entire duplication.

### Non-Goals

- Changes to `Ctrl+C` / `Ctrl+V` (clipboard copy/paste) behaviour — that path is unchanged.
- Smart naming for paste from clipboard — the "(copy)" label suffix remains for paste.
- Prompting the user for a name before duplicating.
- Support for duplicating module definitions or module instances (out of scope; only real `DiagramNode`s).
- Automatic layout adjustment to prevent overlap beyond the +30 px offset.
- Integration with the naming convention engine (`applyNamingTemplate`) during duplication — the label is derived numerically; convention-based renaming is a separate concern.

## 3. Background & Context

### Current duplication flow (`Ctrl+D`)

In `Canvas.svelte` (line 41–46), `Ctrl+D` calls:
```
diagram.copyNodes(ids);
diagram.pasteNodes();
```

`pasteNodes()` (in `diagram.svelte.ts`) iterates the clipboard nodes, calls `generateCopyLabel()` for the display label, and calls `generateUniqueTerraformName()` for the Terraform identifier. Critically:

1. `generateCopyLabel("web-server-1")` → `"web-server-1 (copy)"` — unnatural for infra.
2. `generateUniqueTerraformName("web_server_1", existingNames)` → `"web_server_1_2"` — the suffix is independent of the label, producing a mismatch (label says "copy", TF name says "_2").
3. The duplicate is placed at `position + {30, 30}` relative to the clipboard node. Because `parentId` is only remapped if the parent was also in the clipboard set, a single-node duplicate correctly inherits the original's parent.

### Context menu "Duplicate"

`handleContextDuplicate()` in `DnDFlow.svelte` calls `handleContextCopy()` then `diagram.pasteNodes()`. The same mismatch applies.

### `generateUniqueTerraformName`

Located in `packages/core/src/lib/diagram/node-factory.ts`:
```typescript
export function generateUniqueTerraformName(baseName: string, existingNames: Set<string>): string {
  if (!existingNames.has(baseName)) return baseName;
  let counter = 2;
  while (existingNames.has(`${baseName}_${counter}`)) counter++;
  return `${baseName}_${counter}`;
}
```

### `sanitizeTerraformName`

Located in `packages/core/src/lib/naming/naming-engine.ts` — converts a human label into a valid Terraform identifier (hyphens → underscores, lowercase, strips leading digits/underscores). This is the bridge between the new smart label and the new Terraform name.

### Synthetic node filtering

CLAUDE.md notes that nodes prefixed `_mod_`, `_modinst_`, and `_instmem_` are synthetic and must be excluded from duplication. The existing `copyNodes()` does not filter them; the new `duplicateNodes()` must.

## 4. Detailed Design

### 4.1 Architecture

```mermaid
graph TB
    subgraph "User Interaction"
        KB[Ctrl+D keydown<br/>Canvas.svelte]
        CTX[Context Menu: Duplicate<br/>DnDFlow.svelte]
    end

    subgraph "DiagramStore (diagram.svelte.ts)"
        DUP[duplicateNodes(nodeIds)]
        COLLECT[collectWithChildren<br/>expand to include child nodes]
        LABEL[generateSmartLabel<br/>detect numeric suffix, increment]
        TFNAME[deriveSmartTerraformName<br/>sanitizeTerraformName(newLabel)]
        UNIQUE[generateUniqueTerraformName<br/>ensure no TF name collision]
        REMAP[remapReferences<br/>internal → new IDs<br/>external → unchanged]
        EDGES[cloneInternalEdges<br/>both endpoints in set]
        PUSH[pushSnapshot → undo history]
    end

    subgraph "packages/core"
        SANITIZE[sanitizeTerraformName]
        GUN[generateUniqueTerraformName]
        GNI[generateNodeId]
    end

    KB --> DUP
    CTX --> DUP
    DUP --> COLLECT
    COLLECT --> LABEL
    LABEL --> TFNAME
    TFNAME --> SANITIZE
    SANITIZE --> UNIQUE
    UNIQUE --> GUN
    DUP --> REMAP
    DUP --> EDGES
    DUP --> PUSH
    DUP --> GNI
```

### 4.2 Data Models / Interfaces

No new types are required. The feature operates entirely on existing types from `@terrastudio/types` and `@xyflow/svelte`.

The new helper functions introduced in `diagram.svelte.ts` are module-scope (not exported):

```typescript
/**
 * Smart label increment for duplication.
 *
 * Rules (applied in order):
 *  1. If label already ends with " (copy)" or " (copy N)", strip it first — user
 *     may be duplicating a paste result; we treat the base label as canonical.
 *  2. If the base ends with a numeric suffix separated by a non-alphanumeric
 *     character (hyphen, underscore, space, dot), find the highest sibling suffix
 *     among existingLabels and return base + (max + 1).
 *  3. Otherwise, return `${base}-2` (add "-2" to start a numbered series).
 *
 * existingLabels: all labels currently on the canvas (used to find the
 * highest existing numeric suffix so two rapid duplications don't collide).
 */
function generateSmartLabel(label: string, existingLabels: Set<string>): string;

/**
 * Derive a Terraform name from a human display label.
 * Delegates to sanitizeTerraformName (hyphens→underscores, lowercase, etc.)
 * then passes through generateUniqueTerraformName to avoid collisions.
 */
function deriveSmartTerraformName(
  newLabel: string,
  existingTerraformNames: Set<string>,
): string;
```

### 4.3 Component Breakdown

#### 4.3.1 `generateSmartLabel` (new, `diagram.svelte.ts`)

Logic:

1. Strip trailing "(copy)" / "(copy N)" suffix if present (same regex as existing `generateCopyLabel`). Let the result be `base`.
2. Match `base` against `/^(.*?)([- _.])(\d+)$/` to detect a trailing numeric suffix. If matched:
   - `stem` = capture group 1, `sep` = group 2, `num` = parseInt(group 3).
   - Scan `existingLabels` for all labels matching `stem + sep + \d+`. Find `max` of their numeric parts.
   - Return `stem + sep + (max + 1)`.
3. If no numeric suffix in `base`:
   - Scan `existingLabels` for labels matching `/^{escapedBase}[- _.](\d+)$/`. Find `max` if any exist.
   - If `max` found, return `base + '-' + (max + 1)`.
   - Otherwise return `base + '-2'`.

Examples:

| Input label | Existing labels on canvas | Output |
|---|---|---|
| `web-server-1` | `{web-server-1}` | `web-server-2` |
| `web-server-1` | `{web-server-1, web-server-2}` | `web-server-3` |
| `db` | `{db}` | `db-2` |
| `db` | `{db, db-2, db-3}` | `db-4` |
| `db-2 (copy)` | `{db-2}` | `db-3` |
| `my_vm_01` | `{my_vm_01}` | `my_vm_02` (sep=`_`, num=01→02) |
| `frontend` | `{frontend, frontend-2}` | `frontend-3` |

Note: the algorithm scans `existingLabels` at the time of each duplicate within a multi-duplicate batch, accumulating new labels as it goes (same pattern as `generateUniqueTerraformName`).

#### 4.3.2 `deriveSmartTerraformName` (new, `diagram.svelte.ts`)

```typescript
import { sanitizeTerraformName, generateUniqueTerraformName } from '@terrastudio/core';

function deriveSmartTerraformName(
  newLabel: string,
  existingTerraformNames: Set<string>,
): string {
  const base = sanitizeTerraformName(newLabel);
  return generateUniqueTerraformName(base, existingTerraformNames);
}
```

`sanitizeTerraformName` is already exported from `packages/core/src/index.ts`; confirm this or add the export if missing.

#### 4.3.3 `DiagramStore.duplicateNodes()` (new method)

Full algorithm:

```typescript
duplicateNodes(nodeIds: string[]) {
  this.flushPendingSnapshot();
  this.ensureInitialSnapshot();

  // 1. Filter out synthetic nodes
  const realIds = nodeIds.filter(id => {
    const n = this.nodes.find(n => n.id === id);
    return n && !n.id.startsWith('_mod_') && !n.id.startsWith('_modinst_') && !n.id.startsWith('_instmem_');
  });
  if (realIds.length === 0) return;

  // 2. Expand to include children (same logic as copyNodes)
  const idSet = new Set(realIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of this.nodes) {
      if (n.parentId && idSet.has(n.parentId as string) && !idSet.has(n.id)) {
        idSet.add(n.id);
        changed = true;
      }
    }
  }

  // 3. Build working sets for collision detection
  const existingLabels = new Set(this.nodes.map(n => n.data.label));
  const existingTfNames = new Set(this.nodes.map(n => n.data.terraformName));
  const oldToNew = new Map<string, string>();

  // 4. Assign new IDs upfront
  for (const id of idSet) {
    const node = this.nodes.find(n => n.id === id)!;
    oldToNew.set(id, generateNodeId(node.type as ResourceTypeId));
  }

  // 5. Build new nodes
  const newNodes: DiagramNode[] = [];
  for (const id of idSet) {
    const node = this.nodes.find(n => n.id === id)!;
    const newId = oldToNew.get(id)!;

    // Smart label
    const newLabel = generateSmartLabel(node.data.label, existingLabels);
    existingLabels.add(newLabel);

    // Terraform name derived from new label
    const newTfName = deriveSmartTerraformName(newLabel, existingTfNames);
    existingTfNames.add(newTfName);

    // Remap parentId: if original parent was in the set, point to new parent;
    // if original parent was NOT in the set, preserve the same parentId (stay in container).
    const originalParentId = node.parentId as string | undefined;
    const newParentId = originalParentId
      ? (oldToNew.get(originalParentId) ?? originalParentId)
      : undefined;

    // Remap references: internal → new IDs, external → unchanged
    const newReferences: Record<string, string> = {};
    for (const [key, refId] of Object.entries(node.data.references)) {
      newReferences[key] = oldToNew.get(refId as string) ?? (refId as string);
    }

    // Deep-clone node, apply overrides
    const cloned = structuredClone(
      $state.snapshot(node) as unknown
    ) as DiagramNode;

    const newNode: DiagramNode = {
      ...cloned,
      id: newId,
      position: {
        x: node.position.x + 30,
        y: node.position.y + 30,
      },
      selected: true,
      data: {
        ...cloned.data,
        label: newLabel,
        terraformName: newTfName,
        references: newReferences,
        validationErrors: [],
        deploymentStatus: undefined,
        referenceEdgeOverrides: undefined,
        // variableOverrides, enabledOutputs, connectionPoints,
        // handlePositions, properties are preserved via cloned.data spread
      },
    };

    if (newParentId) {
      newNode.parentId = newParentId;
    } else {
      delete (newNode as Record<string, unknown>).parentId;
      delete (newNode as Record<string, unknown>).extent;
    }

    newNodes.push(newNode);
  }

  // 6. Clone internal edges
  const newEdges: DiagramEdge[] = [];
  for (const edge of this.edges) {
    const newSource = oldToNew.get(edge.source);
    const newTarget = oldToNew.get(edge.target);
    if (!newSource || !newTarget) continue;
    newEdges.push({
      ...edge,
      id: `e-${newSource}-${edge.sourceHandle ?? 'default'}-${newTarget}`,
      source: newSource,
      target: newTarget,
      selected: true,
    });
  }

  // 7. Deselect originals, append duplicates
  this.nodes = [
    ...this.nodes.map(n => ({ ...n, selected: false })),
    ...newNodes,
  ];
  this.edges = [...this.edges, ...newEdges];
  this.selectedNodeId = null;

  this.pushSnapshot();
}
```

#### 4.3.4 Call-site updates

**`Canvas.svelte`** — replace the `Ctrl+D` handler:

```typescript
// Before:
if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
  event.preventDefault();
  const ids = diagram.nodes.filter((n) => n.selected).map((n) => n.id);
  if (ids.length === 0 && diagram.selectedNodeId) ids.push(diagram.selectedNodeId);
  if (ids.length > 0) { diagram.copyNodes(ids); diagram.pasteNodes(); }
  return;
}

// After:
if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
  event.preventDefault();
  const ids = diagram.nodes.filter((n) => n.selected).map((n) => n.id);
  if (ids.length === 0 && diagram.selectedNodeId) ids.push(diagram.selectedNodeId);
  if (ids.length > 0) diagram.duplicateNodes(ids);
  return;
}
```

**`DnDFlow.svelte`** — replace `handleContextDuplicate()`:

```typescript
// Before:
function handleContextDuplicate() {
  handleContextCopy();
  diagram.pasteNodes();
}

// After:
function handleContextDuplicate() {
  const ids = diagram.nodes.filter((n) => n.selected).map((n) => n.id);
  if (contextMenu?.nodeId && !ids.includes(contextMenu.nodeId)) {
    ids.push(contextMenu.nodeId);
  }
  diagram.duplicateNodes(ids);
  closeContextMenu();
}
```

Note: `handleContextDuplicate` no longer calls `handleContextCopy()`, so the clipboard is not overwritten on Ctrl+D. This is a deliberate improvement — duplicate is a distinct action from copy+paste.

### 4.4 API / Contract Changes

`sanitizeTerraformName` must be exported from `packages/core/src/index.ts`. Check current exports:

```typescript
// packages/core/src/index.ts — confirm presence of:
export { sanitizeTerraformName } from './lib/naming/naming-engine.js';
```

If missing, add it. This is the only cross-package change.

## 5. Implementation Plan

### 5.1 Phases

**Phase 1 — Core export verification (5 min)**
Confirm `sanitizeTerraformName` is exported from `packages/core/src/index.ts`. Add the export if it is missing.

**Phase 2 — Helper functions in `diagram.svelte.ts` (30 min)**
Add module-scope helper functions `generateSmartLabel` and `deriveSmartTerraformName` immediately after the existing `generateCopyLabel` function (line 30). Import `sanitizeTerraformName` from `@terrastudio/core` in the import block at the top of the file.

**Phase 3 — `duplicateNodes()` method (45 min)**
Add `duplicateNodes(nodeIds: string[])` to the `DiagramStore` class. Position it after `pasteNodes()` (around line 650) for readability.

**Phase 4 — Call-site updates (10 min)**
- Update `Canvas.svelte`: replace the `Ctrl+D` body (lines 41–46).
- Update `DnDFlow.svelte`: replace `handleContextDuplicate()` body (lines 227–230).

**Phase 5 — Manual testing (20 min)**
Run through the test scenarios listed in Section 7.

### 5.2 File Changes

| File | Action | Description |
|---|---|---|
| `packages/core/src/index.ts` | Modify (if needed) | Add `sanitizeTerraformName` export |
| `apps/desktop/src/lib/stores/diagram.svelte.ts` | Modify | Add `generateSmartLabel`, `deriveSmartTerraformName` helpers; add `duplicateNodes()` method; add import for `sanitizeTerraformName` |
| `apps/desktop/src/lib/components/Canvas.svelte` | Modify | Replace `Ctrl+D` handler body |
| `apps/desktop/src/lib/components/DnDFlow.svelte` | Modify | Replace `handleContextDuplicate()` body |

No new files are created. No packages are added.

### 5.3 Dependencies

No new npm packages required. All utilities (`sanitizeTerraformName`, `generateUniqueTerraformName`, `generateNodeId`) already exist within the monorepo.

## 6. Edge Cases & Error Handling

**Labels with leading zeros** (`my_vm_01`): The regex `/^(.*?)([- _.])(\d+)$/` captures `"01"` as the numeric group. `parseInt("01", 10)` → `1`. Incrementing yields `2`, not `02`. The output `my_vm_02` is intentional — zero-padding is not preserved since Terraform names are identifiers, not fixed-width strings. If zero-padding is a hard requirement in the future, it can be added to `generateSmartLabel` via `String(n).padStart(digits, '0')`.

**Labels without any separator** (`server1`, `rg01`): The regex `/^(.*?)([- _.])(\d+)$/` will not match because there is no separator between stem and number. These are treated as bare labels and get `-2` appended (`server1-2`, `rg01-2`). This is intentional — inserting a numeric suffix without a separator would produce `server12` which is ambiguous.

**Label is purely numeric** (`42`): Treated as a bare label since the regex requires a stem before the separator. Output: `42-2`.

**Duplicate of a container with children**: `collectWithChildren` expands `idSet` before any node is processed. Children are duplicated with their parent in the same batch. Their `parentId` entries point to the new parent ID via `oldToNew`. The parent offset (+30, +30) cascades naturally through Svelte Flow's containment coordinate system (child positions are relative to parent).

**Duplicate of a node whose parent is NOT selected**: The original `parentId` is preserved on the duplicate (it lands in the same container as the original). The container itself is not duplicated.

**Multi-select: partial overlap with a container's children**: If a user selects a VM but not its parent Subnet, the VM's `parentId` is preserved — it remains in the original Subnet. The duplicate VM appears at original position +30, +30 within the same Subnet. This may cause visual overlap. Accepted behaviour for now (out of scope to implement collision detection).

**Duplicate the same node twice in rapid succession**: The second `duplicateNodes()` call fires after the first has committed (both call `pushSnapshot()`). The second call reads `existingLabels` from the updated `this.nodes`, so it correctly finds "web-server-2" and generates "web-server-3". No debounce issue because `duplicateNodes()` always calls `flushPendingSnapshot()` first.

**References from duplicate to outside the set**: A VM that references an NSG outside the duplicated set keeps the reference. The new VM and the original VM both reference the same NSG — this is correct Terraform semantics (two VMs can share an NSG).

**References between nodes within the set**: Both the original edge and a new remapped edge exist on the canvas after duplication. This is correct — original and duplicate are independent resources.

**`_mod_`, `_modinst_`, `_instmem_` nodes**: Filtered out before any processing. If the user has selected a module boundary or instance card along with real nodes (which can happen with Ctrl+A), only the real nodes are duplicated.

**Empty selection**: `duplicateNodes([])` returns immediately after the synthetic-filter step. No mutation occurs, no snapshot is pushed.

**`extent: 'parent'` on children**: Svelte Flow uses this to keep child nodes inside their parent. When a child is duplicated and `newParentId` is set (from `oldToNew`), `extent` is preserved via the spread of `cloned`. When the parent was NOT in the set, `extent` is deleted alongside `parentId` (same guard), preventing orphaned nodes from being locked to their former parent's bounds.

## 7. Testing Strategy

### Unit tests (if test harness exists for `diagram.svelte.ts`)

Test `generateSmartLabel` in isolation with the example table from Section 4.3.1. Key cases:
- Strips "(copy)" before incrementing.
- Correctly finds the max existing suffix when multiple siblings exist.
- Starts at `-2` when no existing siblings.
- Handles leading-zero numerics gracefully (no zero-padding preservation).

### Manual integration tests

| Scenario | Steps | Expected result |
|---|---|---|
| Single node, no numeric suffix | Drop a VM named "vm", duplicate | New node "vm-2", TF name "vm_2" |
| Single node, numeric suffix | Drop a VM named "web-server-1", duplicate | "web-server-2", TF name "web_server_2" |
| Rapid duplicate ×3 | Start with "db", Ctrl+D three times | "db-2", "db-3", "db-4" all present |
| Multi-select, internal edge | Two VMs connected by an edge, select both, Ctrl+D | Two new VMs with the edge between them duplicated; original two nodes and their edge unchanged |
| Multi-select, external reference | VM referencing an NSG, duplicate only the VM | Duplicate VM still references the same NSG |
| Container with children | Subnet containing VM and App Service, select Subnet, Ctrl+D | New Subnet + new VM + new App Service all in same Resource Group; children's labels incremented independently; internal parent-child containment preserved |
| Node inside container, duplicate only child | Select VM inside a Subnet, Ctrl+D | Duplicate VM appears inside the same Subnet at +30/+30; Subnet count is unchanged |
| Context menu duplicate | Right-click a node, choose Duplicate | Same smart naming behaviour; clipboard NOT overwritten (original Ctrl+C clipboard unchanged) |
| Clipboard unchanged after Ctrl+D | Ctrl+C a node, then Ctrl+D a different node, then Ctrl+V | Paste produces the Ctrl+C node, not the Ctrl+D target |
| Undo | Duplicate a node, press Ctrl+Z | Duplicate node removed; original node restored to un-selected state |
| Redo | Duplicate, undo, Ctrl+Y | Duplicate reappears |
| Synthetic nodes selected | Ctrl+A then Ctrl+D (selects module boundaries too) | Only real resource nodes are duplicated; no crash from synthetic nodes |

## 8. Security & Performance Considerations

**Performance**: `duplicateNodes()` iterates `this.nodes` several times (child expansion, label scanning, ID assignment, node construction). For typical diagrams (<200 nodes), this is sub-millisecond. For very large diagrams (500+ nodes), the `generateSmartLabel` scan (which iterates `existingLabels` per node in the batch) is O(N * M) where N = duplicated count and M = total node count. At 500 nodes this is ~250,000 string comparisons — still negligible at human-interaction timescales. No optimisation is needed.

**Terraform name collisions**: `generateUniqueTerraformName` guarantees uniqueness against the `existingTfNames` set, which is built from the live diagram state and augmented as each duplicate is processed within the batch. There is no race condition since the diagram store is synchronous.

**No security implications**: Duplication operates entirely on in-memory diagram state. No network calls, no file I/O, no Tauri commands.

## 9. Open Questions

1. **Zero-padded numeric suffixes**: Should duplicating "web-server-01" produce "web-server-02" (preserving padding width) or "web-server-2" (discarding padding)? The current spec proposes no padding preservation. If padding is required, `generateSmartLabel` can be extended with `String(n).padStart(originalDigits, '0')` trivially.

2. **Separator preference on first duplicate**: When a label has no numeric suffix (e.g., "frontend"), the spec uses a hyphen (`frontend-2`). If the label already uses underscores as the primary separator style (e.g., "app_service"), a hyphen looks inconsistent (`app_service-2`). Should the algorithm infer the separator style from the label? Possible approach: count hyphens vs underscores in the label and use the more common one, defaulting to hyphen.

3. **Clipboard side-effect removal**: The spec proposes that `Ctrl+D` no longer mutates the clipboard (previously `handleContextDuplicate` called `copyNodes` first). This is a behaviour change. Confirm this is acceptable — specifically, does any user workflow rely on `Ctrl+D` also updating the clipboard so a subsequent `Ctrl+V` produces another copy?

4. **`sanitizeTerraformName` export status**: Verify whether `sanitizeTerraformName` is currently exported from `packages/core/src/index.ts`. If not, this is a one-line change but touches the published package API surface.

## 10. References

- `apps/desktop/src/lib/stores/diagram.svelte.ts` — `generateCopyLabel`, `pasteNodes`, `copyNodes`, `DiagramStore`
- `apps/desktop/src/lib/components/Canvas.svelte` — `Ctrl+D` keyboard handler (line 41)
- `apps/desktop/src/lib/components/DnDFlow.svelte` — `handleContextDuplicate` (line 227), context menu markup (line 970)
- `packages/core/src/lib/diagram/node-factory.ts` — `generateUniqueTerraformName`, `generateNodeId`
- `packages/core/src/lib/naming/naming-engine.ts` — `sanitizeTerraformName`
- `packages/types/src/node.ts` — `ResourceNodeData` interface
- `packages/types/src/resource-schema.ts` — `ResourceTypeId`, `ResourceSchema`
- CLAUDE.md — synthetic node prefix conventions (`_mod_`, `_modinst_`, `_instmem_`)
