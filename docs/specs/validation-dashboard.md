# Validation Dashboard (Problems Panel) Specification

**Spec ID**: SPEC-003
**Status**: Draft
**Created**: 2026-03-07
**PRD Source**: Feature request — centralized validation error view, VS Code Problems panel analogue
**Author**: AI Spec Writer

## 1. Overview

TerraStudio currently validates diagrams in two places: inline on canvas nodes (red border + tooltip when `validationErrors` is populated on `ResourceNodeData`) and at HCL-generation time via `terraform-service.ts`. Both sources write to the same `diagram.nodes[].data.validationErrors` field, but there is no central view. Engineers and users must hover each red node individually to discover what is wrong.

This spec defines a **Problems tab** inside the bottom panel system (specified in `docs/specs/bottom-panel-system.md`). The tab provides a VS Code-style problems list: all validation errors and warnings across every resource in the diagram, grouped by resource, sorted by severity, filterable by type and text, and clickable to navigate directly to the offending resource and property. Validation runs reactively on a 500 ms debounce whenever the diagram changes — without waiting for the user to attempt HCL generation.

The feature reuses all existing validation logic. No new validation rules are introduced here; the work is entirely in surfacing results. The single source of truth for errors remains `ResourceNodeData.validationErrors`, with the Problems tab reading from it reactively.

## 2. Goals & Non-Goals

### Goals

- Show all current validation errors and warnings across the entire diagram in a single scrollable list, grouped by resource.
- Run validation reactively on diagram changes (debounced 500 ms) so the list stays current without requiring the user to trigger HCL generation.
- Support filtering by severity (all / errors only / warnings only) and by free-text search against message text and resource label.
- Clicking any problem item selects the resource node on the canvas, pans/zooms the viewport to bring it into view, opens the properties panel if not already open, and scrolls the properties form to highlight the specific property field.
- Display a badge on the Problems tab: red count for errors, amber count for warnings (shown separately), or a combined count when both are present.
- Provide a "Quick Fix" button for auto-fixable problem categories (empty required fields → focus the field in the properties panel; a pluggable fix registry makes future fixes addable without modifying the core component).
- Work symmetrically with inline node validation: the Problems tab reads the same `validationErrors` field that drives red borders on nodes, so the two views are always in sync.
- Integrate with the bottom panel tab bar defined in `bottom-panel-system.md` — keyboard shortcut Ctrl+Shift+M opens the tab.

### Non-Goals

- Defining new validation rules or changing validation logic in `packages/core/`.
- Adding auto-fix logic for complex multi-field or cross-resource corrections (e.g., recalculating CIDR ranges). Quick Fix is intentionally limited to trivial single-field focusable corrections.
- Persisting acknowledged/suppressed warnings across sessions.
- Surfacing Terraform CLI errors (plan/apply output) — those belong in the Terminal tab.
- Replacing inline node validation (red borders + tooltips remain).

## 3. Background & Context

### Current validation flow

`terraform-service.ts` → `generateAndWrite()`:
1. Calls `validateDiagram(resources, registry)` from `packages/core/src/lib/validation/diagram-validator.ts`. This checks property constraints (required fields, length, regex, CIDR format) and reference integrity.
2. Calls `validateNetworkTopology(diagram.nodes)` from `packages/core/src/lib/validation/network-validator.ts`. This checks CIDR containment and subnet overlap.
3. For each `DiagramError`, calls `diagram.setNodeValidationErrors(instanceId, errors)`, which stores `ValidationError[]` into `node.data.validationErrors`.
4. Validation only runs when the user explicitly triggers HCL generation (via the Generate button or Terraform commands). Between edits, the diagram may have silent errors that are invisible until that moment.

### Gap this spec closes

The Problems tab introduces a **continuous background validator** that runs the same two validators reactively as the diagram changes. This decouples error discovery from HCL generation, giving users immediate feedback as they build the diagram — the same experience VS Code provides for code. The background validator does not write Terraform files and does not alter terraform status; it only updates `node.data.validationErrors` and re-derives the Problems list.

### Key existing interfaces

```
packages/types/src/validation.ts     — ValidationError { propertyKey, message, severity }
packages/core/src/lib/validation/
  diagram-validator.ts               — validateDiagram() → DiagramValidationResult { valid, errors: DiagramError[] }
  resource-validator.ts              — validateResourceProperties(), validateRequiredReferences()
  network-validator.ts               — validateNetworkTopology() → TopologyError[]
apps/desktop/src/lib/stores/
  diagram.svelte.ts                  — DiagramStore: nodes, setNodeValidationErrors(), clearAllValidationErrors()
  ui.svelte.ts                       — UiStore: showBottomPanel, activeBottomTab, openBottomPanel()
apps/desktop/src/lib/services/
  terraform-service.ts               — existing call sites for both validators
```

## 4. Detailed Design

### 4.1 Architecture

```mermaid
graph TB
    subgraph "Diagram changes"
        A[diagram.nodes / diagram.edges]
    end

    subgraph "Background Validator (new)"
        B[validation.svelte.ts store]
        B1[validateDiagram()]
        B2[validateNetworkTopology()]
        B3[convertToResourceInstances()]
    end

    subgraph "Node state"
        C[node.data.validationErrors]
    end

    subgraph "UI"
        D[ProblemsTab.svelte]
        D1[ProblemsFilterBar.svelte]
        D2[ProblemsGroup.svelte]
        D3[ProblemItem.svelte]
        E[DefaultResourceNode / ContainerResourceNode - red border unchanged]
        F[BottomPanel tab badge]
    end

    subgraph "Navigation"
        G[diagram.selectedNodeId]
        H[ui.fitView()]
        I[PropertiesPanel property highlight]
    end

    A -- "$effect debounce 500ms" --> B
    B --> B3
    B3 --> B1
    B3 --> B2
    B1 -- "setNodeValidationErrors" --> C
    B2 -- "setNodeValidationErrors" --> C
    C -- "$derived" --> D
    D --> D1
    D --> D2
    D2 --> D3
    C --> E
    C -- "error/warning counts" --> F
    D3 -- "click" --> G
    D3 -- "click" --> H
    D3 -- "click" --> I
```

The key architectural principle is that `validation.svelte.ts` is the **sole owner of background validation**. It is a pure Svelte 5 rune-based store that:

1. Watches `diagram.nodes` and `diagram.edges` reactively via `$effect`.
2. Debounces runs to 500 ms to avoid validating on every keypress.
3. Calls the same validators used by `terraform-service.ts`.
4. Writes results back through `diagram.setNodeValidationErrors()` — the same path `terraform-service` already uses. This means the red-border logic on nodes requires zero changes.
5. Exposes a `$derived` `problems` array that `ProblemsTab.svelte` consumes.

`terraform-service.ts` continues to call the validators itself (it clears errors first with `clearAllValidationErrors()`, then re-validates). After `generateAndWrite()` completes, the background validator's next tick will overwrite with the same results, so there is no conflict.

### 4.2 Data Models / Interfaces

```typescript
// apps/desktop/src/lib/stores/validation.svelte.ts

import type { DiagramError } from '@terrastudio/core';

/** A single flat problem entry for display in the Problems tab. */
export interface ProblemEntry {
  /** Node instance ID — used to navigate and look up the node. */
  instanceId: string;
  /** Human-readable resource label (e.g. "my-vnet"). */
  resourceLabel: string;
  /** ResourceTypeId for icon lookup (e.g. "azurerm/networking/virtual_network"). */
  typeId: string;
  /** The property key that has the error (e.g. "address_space"). Matches PropertySchema.key. */
  propertyKey: string;
  /** Error message text. */
  message: string;
  /** 'error' blocks HCL generation; 'warning' does not. */
  severity: 'error' | 'warning';
  /**
   * If set, a Quick Fix is available for this problem.
   * The fix handler receives the instanceId and propertyKey and performs
   * the correction (e.g. selecting the node and focusing the field).
   */
  quickFix?: QuickFix;
}

export interface QuickFix {
  /** Short label shown on the button, e.g. "Focus field". */
  label: string;
  /** Called when the user clicks the Quick Fix button. */
  apply: (instanceId: string, propertyKey: string) => void;
}

/** Grouped view for display: one group per resource instance. */
export interface ProblemsGroup {
  instanceId: string;
  resourceLabel: string;
  typeId: string;
  errorCount: number;
  warningCount: number;
  problems: ProblemEntry[];
}

/** The shape exposed by ValidationStore. */
export interface ValidationState {
  /** Flat list of all current problems, errors before warnings. */
  problems: ProblemEntry[];
  /** Grouped by resource, sorted: groups with errors first. */
  groups: ProblemsGroup[];
  /** Total error count across all resources. */
  errorCount: number;
  /** Total warning count across all resources. */
  warningCount: number;
  /** True while the debounce timer is pending (validation not yet complete). */
  pending: boolean;
}
```

```typescript
// Extension to UiStore (apps/desktop/src/lib/stores/ui.svelte.ts)
// (Defined in bottom-panel-system.md — repeated here for clarity)

export type BottomPanelTab = 'terminal' | 'problems' | 'search' | 'annotations' | 'connection-wizard';

// New fields on UiStore:
//   showBottomPanel: boolean
//   activeBottomTab: BottomPanelTab
//   bottomPanelHeight: number
//   openBottomPanel(tab: BottomPanelTab): void
//   toggleBottomPanel(tab: BottomPanelTab): void

/** Key added to UiStore for scrolling properties panel to a specific field. */
// highlightedPropertyKey: string | null  — set when navigating from Problems tab,
// cleared when the properties panel mounts/updates and applies the highlight.
```

```typescript
// New field on UiStore to support property highlighting:

class UiStore {
  // ...existing fields...

  /**
   * When set, the PropertiesPanel scrolls to and visually highlights
   * the property field with this key. Cleared after one render.
   */
  highlightedPropertyKey = $state<string | null>(null);
}
```

### 4.3 Component Breakdown

#### `apps/desktop/src/lib/stores/validation.svelte.ts` (new)

The background validation store. Central to the entire feature.

```typescript
import { validateDiagram, validateNetworkTopology, convertToResourceInstances } from '@terrastudio/core';
import { diagram } from './diagram.svelte';
import { registry } from '$lib/bootstrap';
import type { ProblemEntry, ProblemsGroup, ValidationState } from './validation.svelte';

class ValidationStore {
  private _problems = $state<ProblemEntry[]>([]);
  private _pending = $state(false);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly problems = $derived(this._problems);
  readonly pending = $derived(this._pending);

  readonly groups = $derived.by((): ProblemsGroup[] => {
    const map = new Map<string, ProblemsGroup>();
    for (const p of this._problems) {
      let group = map.get(p.instanceId);
      if (!group) {
        group = {
          instanceId: p.instanceId,
          resourceLabel: p.resourceLabel,
          typeId: p.typeId,
          errorCount: 0,
          warningCount: 0,
          problems: [],
        };
        map.set(p.instanceId, group);
      }
      group.problems.push(p);
      if (p.severity === 'error') group.errorCount++;
      else group.warningCount++;
    }
    // Sort: groups with errors first, then by label
    return [...map.values()].sort((a, b) => {
      if (a.errorCount > 0 && b.errorCount === 0) return -1;
      if (a.errorCount === 0 && b.errorCount > 0) return 1;
      return a.resourceLabel.localeCompare(b.resourceLabel);
    });
  });

  readonly errorCount = $derived(this._problems.filter((p) => p.severity === 'error').length);
  readonly warningCount = $derived(this._problems.filter((p) => p.severity === 'warning').length);

  /** Call once on app bootstrap to start reactive watching. */
  init() {
    $effect.root(() => {
      $effect(() => {
        // Touch reactive dependencies
        void diagram.nodes;
        void diagram.edges;

        this._pending = true;
        if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          this.debounceTimer = null;
          this.runValidation();
        }, 500);
      });
    });
  }

  private runValidation() {
    const nodes = diagram.nodes;
    const edges = diagram.edges;

    // Filter out synthetic module nodes (same filter as HCL generation)
    const realNodes = nodes.filter(
      (n) => !n.id.startsWith('_mod_') && !n.id.startsWith('_modinst_') && !n.id.startsWith('_instmem_'),
    );

    diagram.clearAllValidationErrors();

    const resources = convertToResourceInstances(
      realNodes,
      edges,
      registry.connectionRules,
      (typeId) => registry.getResourceSchema(typeId),
    );

    const diagramResult = validateDiagram(resources, registry.inner);
    const topologyErrors = validateNetworkTopology(realNodes as any);

    const allEntries: ProblemEntry[] = [];

    for (const de of diagramResult.errors) {
      diagram.setNodeValidationErrors(de.instanceId, de.errors);
      for (const err of de.errors) {
        allEntries.push({
          instanceId: de.instanceId,
          resourceLabel: de.label,
          typeId: de.typeId,
          propertyKey: err.propertyKey,
          message: err.message,
          severity: err.severity,
          quickFix: this.resolveQuickFix(err.propertyKey, err.severity),
        });
      }
    }

    for (const te of topologyErrors) {
      const node = realNodes.find((n) => n.id === te.instanceId);
      const label = node?.data?.label ?? te.instanceId;
      const typeId = node?.type ?? '';
      diagram.setNodeValidationErrors(te.instanceId, te.errors);
      for (const err of te.errors) {
        allEntries.push({
          instanceId: te.instanceId,
          resourceLabel: label,
          typeId,
          propertyKey: err.propertyKey,
          message: err.message,
          severity: err.severity,
        });
      }
    }

    // Sort: errors before warnings
    allEntries.sort((a, b) => {
      if (a.severity === 'error' && b.severity === 'warning') return -1;
      if (a.severity === 'warning' && b.severity === 'error') return 1;
      return 0;
    });

    this._problems = allEntries;
    this._pending = false;
  }

  /**
   * Returns a QuickFix for problems that have a trivial automated resolution.
   * Currently: any required-field error → "Focus field" (selects the node and
   * scrolls properties panel to the field).
   * Extend this map as new fix types are added.
   */
  private resolveQuickFix(propertyKey: string, severity: 'error' | 'warning'): QuickFix | undefined {
    if (severity !== 'error') return undefined;
    if (propertyKey.startsWith('_')) return undefined; // system keys (e.g. _type)
    return {
      label: 'Focus field',
      apply: focusPropertyField,
    };
  }
}

export const validation = new ValidationStore();
```

#### `apps/desktop/src/lib/components/bottom/ProblemsTab.svelte` (new)

The root component for the Problems tab. Composes the filter bar, empty state, and the list of groups.

Responsibilities:
- Reads from `validation.groups` and `validation.pending`.
- Maintains local filter state: `severityFilter: 'all' | 'error' | 'warning'` and `searchText: string`.
- Derives `filteredGroups` by applying both filters.
- Renders `ProblemsFilterBar.svelte` at the top.
- Renders an empty-state message when no problems exist.
- Renders one `ProblemsGroup.svelte` per group.

Filter logic:
```typescript
const filteredGroups = $derived.by(() => {
  const q = searchText.toLowerCase().trim();
  return validation.groups
    .map((g) => ({
      ...g,
      problems: g.problems.filter((p) => {
        if (severityFilter !== 'all' && p.severity !== severityFilter) return false;
        if (q && !p.message.toLowerCase().includes(q) && !p.resourceLabel.toLowerCase().includes(q)) return false;
        return true;
      }),
    }))
    .filter((g) => g.problems.length > 0);
});
```

#### `apps/desktop/src/lib/components/bottom/ProblemsFilterBar.svelte` (new)

A toolbar row inside the Problems tab. Contains:

- Three toggle buttons: **All** / **Errors** / **Warnings** — each shows a count chip. Clicking sets `severityFilter`.
- A text `<input>` for free-text search. Has a clear button (×) when non-empty.
- A spinner/dot when `validation.pending` is true.

Props:
```typescript
interface Props {
  severityFilter: 'all' | 'error' | 'warning';
  onSeverityChange: (v: 'all' | 'error' | 'warning') => void;
  searchText: string;
  onSearchChange: (v: string) => void;
  errorCount: number;
  warningCount: number;
  pending: boolean;
}
```

#### `apps/desktop/src/lib/components/bottom/ProblemsGroup.svelte` (new)

Renders a collapsible group for one resource. The group header shows:

- A collapse/expand chevron.
- The resource's icon (via `registry.getIcon(typeId)`), rendered as a small 16×16 SVG.
- The resource label (`group.resourceLabel`).
- A red pill with error count (if > 0).
- An amber pill with warning count (if > 0).

The body contains a `ProblemItem.svelte` for each problem in the group.

Groups start expanded by default. Collapsed state is local to the component session (not persisted).

#### `apps/desktop/src/lib/components/bottom/ProblemItem.svelte` (new)

Renders a single problem row. Layout (left to right):

1. **Severity icon**: A red filled circle for `error`, amber triangle for `warning` (14×14 SVG inline).
2. **Property key**: Displayed in a monospace dim style (e.g. `address_space`).
3. **Message text**: Primary text, truncated with `text-overflow: ellipsis`.
4. **Quick Fix button** (optional): Small inline button labeled "Fix" — only rendered when `problem.quickFix` is defined.

The entire row is a `<button>` (or `role="button"`) that triggers `navigateToProblem(problem)` on click. The Quick Fix button calls `e.stopPropagation()` then `problem.quickFix.apply(...)`.

#### Navigation helper: `apps/desktop/src/lib/services/problem-navigation.ts` (new)

Centralises the "navigate to problem" logic so it can be reused by keyboard shortcuts or other surfaces in future.

```typescript
import { diagram } from '$lib/stores/diagram.svelte';
import { ui } from '$lib/stores/ui.svelte';
import type { ProblemEntry } from '$lib/stores/validation.svelte';

/**
 * Selects the resource node, pans to it, opens the properties panel,
 * and highlights the specific property field.
 */
export function navigateToProblem(problem: ProblemEntry): void {
  // 1. Select the node
  diagram.selectedNodeId = problem.instanceId;

  // 2. Ensure properties panel is visible
  ui.showPropertiesPanel = true;

  // 3. Pan canvas to the node
  //    ui.fitViewToNode is a new UiStore method (see section 4.4)
  ui.fitViewToNode?.(problem.instanceId);

  // 4. Signal the PropertiesPanel to scroll + highlight the field
  ui.highlightedPropertyKey = problem.propertyKey;
}

/**
 * Quick Fix: select the node, open properties panel, and focus the input
 * for the given property key. The PropertiesPanel observes highlightedPropertyKey
 * and calls focus() on the matching input after the next tick.
 */
export function focusPropertyField(instanceId: string, propertyKey: string): void {
  navigateToProblem({
    instanceId,
    propertyKey,
    resourceLabel: '',
    typeId: '',
    message: '',
    severity: 'error',
  });
}
```

#### `BottomPanel.svelte` (per `bottom-panel-system.md`)

The Problems tab is one tab in the bottom panel. The tab label renders as:

```
Problems [3] [2]
```
where `[3]` is a red badge (error count) and `[2]` is an amber badge (warning count). When both are 0, no badges are shown.

The tab is always present in the tab bar (not conditionally rendered), mirroring VS Code behaviour.

### 4.4 API / Contract Changes

#### `UiStore` additions (`apps/desktop/src/lib/stores/ui.svelte.ts`)

```typescript
class UiStore {
  // --- Bottom Panel (defined in bottom-panel-system.md) ---
  showBottomPanel = $state(false);
  activeBottomTab = $state<BottomPanelTab>('terminal');
  bottomPanelHeight = $state(
    typeof localStorage !== 'undefined'
      ? Number(localStorage.getItem('terrastudio-bottom-panel-height') ?? 200)
      : 200
  );

  openBottomPanel(tab: BottomPanelTab) {
    this.activeBottomTab = tab;
    this.showBottomPanel = true;
  }

  toggleBottomPanel(tab: BottomPanelTab) {
    if (this.showBottomPanel && this.activeBottomTab === tab) {
      this.showBottomPanel = false;
    } else {
      this.activeBottomTab = tab;
      this.showBottomPanel = true;
    }
  }

  // --- Property highlight (new for validation navigation) ---
  highlightedPropertyKey = $state<string | null>(null);

  // --- Node focus for canvas navigation (new) ---
  /**
   * Assigned by DnDFlow (same pattern as fitView).
   * Pans and zooms the canvas so the given node is centered in view.
   */
  fitViewToNode: ((nodeId: string) => void) | null = $state(null);
}
```

#### `DnDFlow.svelte` — expose `fitViewToNode`

```typescript
// Inside DnDFlow, alongside existing fitView assignment:
const { screenToFlowPosition, fitView, setCenter, getNode } = useSvelteFlow();

$effect(() => {
  ui.fitViewToNode = (nodeId: string) => {
    const node = getNode(nodeId);
    if (!node) return;
    const x = (node.position.x ?? 0) + (node.measured?.width ?? 150) / 2;
    const y = (node.position.y ?? 0) + (node.measured?.height ?? 50) / 2;
    setCenter(x, y, { zoom: 1, duration: 400 });
  };
  return () => { ui.fitViewToNode = null; };
});
```

`setCenter` and `getNode` are both available from `useSvelteFlow()` in `@xyflow/svelte`.

#### `PropertiesPanel.svelte` — property highlight

Add a `$effect` that watches `ui.highlightedPropertyKey` and scrolls + briefly highlights the matching field:

```typescript
$effect(() => {
  const key = ui.highlightedPropertyKey;
  if (!key) return;
  // Clear immediately so the effect re-fires on repeated navigation to same key
  ui.highlightedPropertyKey = null;

  // After Svelte's next DOM update, find and scroll to the field
  tick().then(() => {
    const el = document.querySelector<HTMLElement>(`[data-property-key="${key}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('property-highlighted');
    setTimeout(() => el.classList.remove('property-highlighted'), 1500);
  });
});
```

Each property row in `PropertyRenderer.svelte` must add `data-property-key={prop.key}` to its root element.

#### Bootstrap (`apps/desktop/src/lib/bootstrap.ts`)

```typescript
import { validation } from '$lib/stores/validation.svelte';

// At the end of declarePlugins() or in a new initValidation() call from +page.svelte:
validation.init();
```

`validation.init()` must be called once after plugins are declared so that `registry` is populated before the first validation run.

## 5. Implementation Plan

### 5.1 Phases

**Phase 1 — Bottom Panel infrastructure** (prerequisite, per `bottom-panel-system.md`)

If the `BottomPanel.svelte` + `BottomPanelTab` system is not yet implemented, it must be done first. This spec assumes that infrastructure exists before the Problems tab is wired in.

Deliverables:
- `BottomPanel.svelte` replaces `TerminalPanel.svelte` in `EditorArea.svelte`.
- `TerminalTab.svelte` contains migrated terminal content.
- `UiStore` has `showBottomPanel`, `activeBottomTab`, `bottomPanelHeight`, `openBottomPanel()`, `toggleBottomPanel()`.
- The Ctrl+Shift+M keyboard shortcut is registered.

**Phase 2 — Background validation store**

Deliverables:
- `apps/desktop/src/lib/stores/validation.svelte.ts` — `ValidationStore` class + `validation` singleton.
- Wire `validation.init()` into `bootstrap.ts` / `+page.svelte`.
- Manual smoke test: add a VNet to the canvas with an empty required field → observe the node getting a red border immediately after 500 ms without clicking Generate.

**Phase 3 — Problems tab UI components**

Deliverables:
- `apps/desktop/src/lib/components/bottom/ProblemsTab.svelte`
- `apps/desktop/src/lib/components/bottom/ProblemsFilterBar.svelte`
- `apps/desktop/src/lib/components/bottom/ProblemsGroup.svelte`
- `apps/desktop/src/lib/components/bottom/ProblemItem.svelte`
- Register `ProblemsTab` in `BottomPanel.svelte`.
- Badge counts wired in the tab bar.

**Phase 4 — Navigation**

Deliverables:
- `apps/desktop/src/lib/services/problem-navigation.ts` — `navigateToProblem()` + `focusPropertyField()`.
- `ui.fitViewToNode` assigned in `DnDFlow.svelte`.
- `ui.highlightedPropertyKey` observed in `PropertiesPanel.svelte`.
- `data-property-key` attribute added to each property row in `PropertyRenderer.svelte`.
- CSS rule for `.property-highlighted` added to `PropertyRenderer.svelte` or a global stylesheet.

**Phase 5 — Quick Fix**

Deliverables:
- `resolveQuickFix()` in `ValidationStore` maps required-field errors to the `focusPropertyField` fix.
- "Fix" button rendered in `ProblemItem.svelte`.
- Manual test: required field error → click Fix → field is focused and visible.

**Phase 6 — Keyboard shortcut + Status Bar integration**

Deliverables:
- `+page.svelte`: `Ctrl+Shift+M` calls `ui.openBottomPanel('problems')`.
- `StatusBar.svelte`: Add a small problems indicator (e.g., `⊘ 3 errors` in red) that when clicked opens the Problems tab. Only visible when `validation.errorCount > 0 || validation.warningCount > 0`.

### 5.2 File Changes

| Path | Action | Notes |
|------|--------|-------|
| `apps/desktop/src/lib/stores/validation.svelte.ts` | Create | `ValidationStore` + `validation` singleton |
| `apps/desktop/src/lib/stores/ui.svelte.ts` | Modify | Add `highlightedPropertyKey`, `fitViewToNode`, bottom panel fields |
| `apps/desktop/src/lib/components/bottom/ProblemsTab.svelte` | Create | Root Problems tab component |
| `apps/desktop/src/lib/components/bottom/ProblemsFilterBar.svelte` | Create | Severity filter + search input |
| `apps/desktop/src/lib/components/bottom/ProblemsGroup.svelte` | Create | Collapsible resource group |
| `apps/desktop/src/lib/components/bottom/ProblemItem.svelte` | Create | Individual problem row |
| `apps/desktop/src/lib/services/problem-navigation.ts` | Create | `navigateToProblem()`, `focusPropertyField()` |
| `apps/desktop/src/lib/components/DnDFlow.svelte` | Modify | Assign `ui.fitViewToNode` using `setCenter` + `getNode` |
| `apps/desktop/src/lib/components/PropertiesPanel.svelte` | Modify | `$effect` for `highlightedPropertyKey`, scroll + highlight |
| `apps/desktop/src/lib/components/PropertyRenderer.svelte` | Modify | Add `data-property-key={prop.key}` to each property row root |
| `apps/desktop/src/lib/bootstrap.ts` | Modify | Call `validation.init()` |
| `apps/desktop/src/routes/+page.svelte` | Modify | `Ctrl+Shift+M` shortcut, import `validation` |
| `apps/desktop/src/lib/components/StatusBar.svelte` | Modify | Problems indicator chip |
| `apps/desktop/src/lib/components/EditorArea.svelte` | Modify | Replace `<TerminalPanel>` with `<BottomPanel>` (Phase 1) |
| `apps/desktop/src/lib/components/BottomPanel.svelte` | Create | Tab bar + content (Phase 1) |
| `apps/desktop/src/lib/components/bottom/TerminalTab.svelte` | Create | Migrated from `TerminalPanel.svelte` (Phase 1) |

### 5.3 Dependencies

No new npm packages required. All validation logic already exists in `@terrastudio/core`. Navigation uses `@xyflow/svelte`'s existing `useSvelteFlow()` hook (`setCenter`, `getNode` are part of the public API).

The `bottom/` subdirectory under `components/` is a new organizational convention for bottom-panel tab components. No package changes are needed.

## 6. Edge Cases & Error Handling

**Empty diagram**: `runValidation()` with no nodes produces an empty `_problems` array. The Problems tab shows the "No problems detected" empty state. No errors should be thrown.

**Synthetic node filtering**: The `_mod_`, `_modinst_`, and `_instmem_` prefixed nodes must be filtered out before passing nodes to `convertToResourceInstances()` and `validateNetworkTopology()`. These synthetic nodes have no schemas and would cause `validateDiagram` to emit "Unknown resource type" errors. This mirrors the filter already applied in `terraform-service.ts`.

**Unknown resource type**: If a node's `typeId` is not in the registry (e.g., a plugin was removed after saving), `validateDiagram` already produces a `_type` error. This surfaces in the Problems tab as an error row with `propertyKey: '_type'`. The Quick Fix resolver returns `undefined` for keys starting with `_`, so no Fix button is shown. The navigation still works — the node is selected and the properties panel opens (it will show "Unknown type" gracefully since `PropertiesPanel` already handles a null schema).

**Rapid typing debounce**: The 500 ms debounce in `ValidationStore` matches the 500 ms debounce in `DiagramStore.updateNodeData()`. This means: user types in a field → diagram updates after 500 ms → validation fires 500 ms later. In the worst case, there is a 1-second lag from keystroke to Problems update. This is acceptable. A future optimisation could set the validation debounce to 300 ms and rely on the diagram debounce to have already settled.

**Concurrent validation runs**: The debounce timer is cleared on each diagram change. The previous `runValidation()` call (a synchronous function) will have already completed before the new timer fires, so there is no true concurrency issue. If `runValidation()` is made async in future (e.g., for a Web Worker), a cancellation token must be added.

**Navigation to a node in a collapsed module**: If the target node is a member of a collapsed module (rendered as a `_mod_` synthetic node), `getNode(instanceId)` will return `undefined` because the real node is not in the SvelteFlow render tree. In this case, `fitViewToNode` should fall back to finding the synthetic `_mod_{moduleId}` placeholder node and centering on that instead. The selection (`diagram.selectedNodeId = instanceId`) still works — the properties panel reads directly from `diagram.nodes` by ID, not from the SvelteFlow render tree.

**Property key `_type`**: The `data-property-key` attribute lookup in `PropertiesPanel` will find nothing for `_type` errors (no property row is rendered for system keys). The scroll/highlight attempt silently does nothing — no error thrown.

**Quick Fix on topology warnings**: `resolveQuickFix` returns `undefined` for `severity === 'warning'`. Topology warnings (subnet CIDR overlap) are not auto-fixable because the resolution requires the user to choose which subnet to change. The row renders without a Fix button.

**Validation during HCL generation**: `terraform-service.ts` calls `diagram.clearAllValidationErrors()` then validates. During this window, the Problems tab briefly shows no problems. The background validator will re-fire ~500 ms later (triggered by the `clearAllValidationErrors` mutation to `diagram.nodes`) and repopulate results. This transient flash is acceptable.

## 7. Testing Strategy

### Unit tests

**`packages/core/src/lib/validation/`** — existing validators already have or should have unit tests. No new unit tests needed here for this feature.

**`validation.svelte.ts`** — use `@testing-library/svelte` or a pure Svelte test harness:
- `runValidation()` with a diagram containing a node with empty required fields → `errorCount > 0`, `groups.length > 0`, correct `instanceId` and `propertyKey`.
- `runValidation()` with no nodes → `errorCount === 0`, `groups.length === 0`.
- Filter logic in `ProblemsTab` (can be extracted to a pure function and unit tested): severity filter + text search produce correct subsets.
- `resolveQuickFix` returns `undefined` for `_type` keys and for warnings.

### Integration tests (manual)

| Scenario | Expected result |
|----------|----------------|
| Open a project, add a VNet, leave `address_space` empty | After 500 ms, Problems tab badge shows 1 error; VNet node has red border |
| Click the problem row | VNet node selected, canvas pans to it, properties panel open, `address_space` field highlighted in amber for 1.5 s |
| Click "Fix" button on the error row | Same navigation as above, `address_space` input receives browser focus |
| Type a valid CIDR into the field | After 500 ms + 500 ms debounce, Problems tab badge clears; red border gone |
| Add a subnet with CIDR outside VNet address space | Topology warning appears for the subnet's `address_prefixes` property |
| Filter by "Errors only" when both errors and warnings exist | Only error rows visible; warning rows hidden |
| Type "CIDR" in search box | Only rows whose message contains "CIDR" shown |
| Collapse a module containing a resource with errors | Problems tab still lists the error; clicking navigates to the synthetic `_mod_*` node |
| Delete a node that had errors | Problems list updates after next debounce tick; deleted node's group removed |

### Regression

- Existing inline validation (red borders on nodes) must remain unchanged — `setNodeValidationErrors` is called by both `ValidationStore` and `terraform-service.ts`, and both paths must continue to work.
- HCL generation with validation errors still blocks Terraform commands — `terraform-service.ts` is not modified in this regard.

## 8. Security & Performance Considerations

**Performance — validation frequency**: The 500 ms debounce ensures at most one validation run per 500 ms of user activity. `validateDiagram` and `validateNetworkTopology` are O(n) in the number of resources and O(n²) in the number of sibling subnets within a VNet. For typical diagrams (< 200 resources), both complete in < 5 ms. No Web Worker is needed. If diagrams regularly exceed 500 resources, moving `runValidation()` to a Web Worker should be reconsidered; this is noted as a future option.

**Performance — reactive derivations**: `validation.groups` and `validation.errorCount` are `$derived` from `validation._problems` (an array). Svelte 5's fine-grained reactivity re-derives only when `_problems` changes. The component tree (`ProblemsTab` → `ProblemsGroup` → `ProblemItem`) re-renders only the changed items due to Svelte's keyed `{#each}` blocks.

**Performance — `clearAllValidationErrors`**: This method mutates every node in `diagram.nodes`, triggering a full reactive update. It is called both by `terraform-service.ts` (user-initiated) and by `ValidationStore.runValidation()`. To reduce unnecessary renders, consider changing `clearAllValidationErrors` to only update nodes that currently have non-empty `validationErrors`. This is a minor optimisation; the existing implementation is correct.

**Security**: The Problems tab reads from the diagram's own validation state. No IPC calls, no file system access, no network requests are involved. Validation messages are constructed from schema-defined strings and user-entered property values; they are rendered as text content (not `innerHTML`), so XSS is not a concern.

**Memory**: The `_problems` array is bounded by the number of nodes × the average number of errors per node. For typical diagrams this is < 1000 entries. No unbounded accumulation occurs.

## 9. Open Questions

1. **Bottom Panel Phase 1 prerequisite**: The `BottomPanel.svelte` + `BottomPanelTab` system described in `bottom-panel-system.md` is a prerequisite. Is that work already scheduled? If not, should Phase 1 of this spec include it, or should both specs be gated on a separate bottom-panel ticket?

2. **`$effect.root` usage for long-lived effects**: `ValidationStore.init()` uses `$effect.root()` to create a reactive effect outside a component lifecycle. This is the documented Svelte 5 pattern for stores. Confirm this is the established convention for other stores in the project (e.g., the MCP `DiagramSyncStore` pattern).

3. **`convertToResourceInstances` availability**: `terraform-service.ts` imports `convertToResourceInstances` from `@terrastudio/core`. The `ValidationStore` will need the same import. Confirm this function is exported from the core package's public `index.ts`. If not, it must be added to the exports.

4. **`getNode` in `useSvelteFlow`**: The navigation logic calls `getNode(nodeId)` from `useSvelteFlow()`. Verify this function is available in the version of `@xyflow/svelte` currently installed. If not, `diagram.nodes.find(n => n.id === nodeId)` can be used as the position source instead, though it requires computing the center position manually.

5. **Property highlight CSS**: The `.property-highlighted` class needs a CSS animation (e.g., a brief amber background flash). Should this be added to `PropertyRenderer.svelte`'s `<style>` block (scoped) or to a global stylesheet? If scoped, the `classList.add` from `PropertiesPanel.svelte` may need to target a specific element structure.

6. **Debounce timing interaction**: With `diagram.updateNodeData` also debouncing at 500 ms before committing to history (but updating `diagram.nodes` immediately), the validation store sees the node change immediately but the undo history lags. This is correct — validation should reflect the current input state, not the committed history state. Confirm there are no edge cases where `clearAllValidationErrors()` called from `terraform-service.ts` races with the validation debounce and produces a visible flicker that is unacceptable to product.

## 10. References

- `docs/specs/bottom-panel-system.md` — Bottom Panel infrastructure (prerequisite)
- `packages/core/src/lib/validation/diagram-validator.ts` — `validateDiagram()`, `DiagramError`, `DiagramValidationResult`
- `packages/core/src/lib/validation/resource-validator.ts` — `validateResourceProperties()`, `validateRequiredReferences()`
- `packages/core/src/lib/validation/network-validator.ts` — `validateNetworkTopology()`, `TopologyError`
- `packages/types/src/validation.ts` — `ValidationError`, `PropertyValidation`
- `packages/types/src/node.ts` — `ResourceNodeData.validationErrors`
- `apps/desktop/src/lib/stores/diagram.svelte.ts` — `setNodeValidationErrors()`, `clearAllValidationErrors()`
- `apps/desktop/src/lib/stores/ui.svelte.ts` — `UiStore`, `fitView` assignment pattern
- `apps/desktop/src/lib/services/terraform-service.ts` — existing validation call sites
- `apps/desktop/src/lib/components/DnDFlow.svelte` — `useSvelteFlow()` hook, `fitView` exposure pattern
- `apps/desktop/src/lib/components/PropertiesPanel.svelte` — property rendering target
- `apps/desktop/src/lib/components/PropertyRenderer.svelte` — per-property rows
- [@xyflow/svelte `useSvelteFlow` API](https://svelteflow.dev/api-reference/hooks/use-svelte-flow)
