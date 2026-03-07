# Cost Breakdown by Module / Container Specification

**Spec ID**: SPEC-002
**Status**: Draft
**Created**: 2026-03-07
**PRD Source**: Product requirement — "Cost Breakdown by Module/Container" feature request
**Author**: AI Spec Writer

---

## 1. Overview

TerraStudio's cost estimation panel already fetches per-resource pricing and displays a flat list
grouped by resource category. This spec extends that capability to provide two additional grouping
views — "By Container" and "By Module" — that map cloud spending to the logical and architectural
units users think in: resource groups, VPCs, and named modules.

The feature adds a view-toggle to the cost panel (Category / Container / Module), computes
aggregate subtotals for each group, renders a proportional horizontal bar chart under the summary
header, and surfaces aggregate cost badges on collapsed module nodes and container node headers.
The existing per-resource cost data (`CostStore.estimates`) is the sole source of truth; no new
API calls or pricing logic is required. All grouping is pure derived computation from the existing
`DiagramNode` graph and `ModuleDefinition` / `ModuleInstance` records.

An enhanced CSV export includes the group column so finance teams can slice cost data by
infrastructure boundary without leaving their spreadsheet tools.

---

## 2. Goals & Non-Goals

### Goals

- Add a three-way view toggle ("By Category", "By Container", "By Module") to `CostPanel.svelte`
  that switches the breakdown list without re-fetching prices.
- Compute container subtotals by walking `node.parentId` up to the nearest "billing container"
  (Resource Group for Azure, VPC for AWS) and summing all descendant resource costs.
- Compute module subtotals by matching `node.data.moduleId` against `diagram.modules` and summing
  member costs; handle template instances separately with their own subtotal rows.
- Render a horizontal proportional bar chart below the summary total showing relative cost share
  per group (top N groups, remainder collapsed into "Other").
- Support drill-down: clicking a group row expands it to show the individual resource rows within
  that group (collapsible, persisted per session in local component state).
- Extend `CostStore.exportCsv()` to accept a `groupBy` parameter and include a "Group" column in
  the output.
- Add aggregate cost badges on collapsed module nodes (`ModuleNode.svelte`) using the same
  `ui.showCostBadges` gate already used by container and leaf nodes.
- Update the existing container cost badge logic to show aggregate child costs, not just the
  container resource's own cost (which is $0 for Resource Groups and VPCs).

### Non-Goals

- SKU comparison / "what-if" cost modeling (noted as a future feature; no implementation here).
- Nested container drill-down beyond one level (e.g., Subscription > Resource Group >  VNet >
  Subnet hierarchy). The "By Container" view stops at the top-level billing container.
- Saving the selected view mode to the project file.
- Real-time cost streaming or incremental re-fetch on property change (existing dirty-banner
  mechanism is sufficient).
- Any changes to how prices are fetched or calculated.
- Persisting expanded/collapsed drill-down state across sessions.

---

## 3. Background & Context

### Current state

`CostStore` (`apps/desktop/src/lib/stores/cost.svelte.ts`) holds:

```
estimates: Map<nodeId, CostEstimate>
```

Each `CostEstimate` carries `monthlyCost: number | null` and `breakdown: { label, cost }[]`.

`CostPanel.svelte` computes `groupedEstimates` — a `$derived` that groups by the middle segment of
`typeId` (e.g., `compute`, `networking`) — and renders collapsible `CollapsibleSection` rows. A
single "By Resource Type" view exists.

Container nodes already read their own cost via `cost.estimates.get(id)` and show a `cost-chip` in
their header. But Resource Groups and VPCs have `monthlyCost = 0` (they are in `FREE_TYPE_IDS`),
so the cost badge never renders on the container boundary even though children may cost hundreds of
dollars.

`ModuleNode.svelte` has no cost awareness whatsoever.

### Diagram graph structure relevant to grouping

```
DiagramNode.parentId      → points to the direct parent container node
DiagramNode.data.moduleId → points to a ModuleDefinition.id (logical grouping, orthogonal to parentId)
diagram.modules           → ModuleDefinition[] (includes isTemplate flag)
diagram.moduleInstances   → ModuleInstance[] (each references a templateId)
```

Synthetic node prefixes (`_mod_`, `_modinst_`, `_instmem_`) must be excluded from all cost
aggregation (they are visual-only scaffolding, not real infrastructure).

### Container type identifiers

| Provider | Billing container typeId         | Notes                              |
|----------|----------------------------------|------------------------------------|
| Azure    | `azurerm/core/resource_group`    | Top-level billing boundary         |
| Azure    | `azurerm/core/subscription`      | Parent of RGs — skip in grouping   |
| AWS      | `aws/networking/vpc`             | Primary grouping container for AWS |

Resources not inside any billing container are placed in an "Unassigned" group.

---

## 4. Detailed Design

### 4.1 Architecture

```mermaid
graph TB
    subgraph CostStore ["CostStore (cost.svelte.ts)"]
        E[estimates: Map&lt;nodeId, CostEstimate&gt;]
        NEW1[containerGroups: CostGroup[] — derived]
        NEW2[moduleGroups: CostGroup[] — derived]
        NEW3[exportCsv — extended]
    end

    subgraph DiagramStore ["DiagramStore (diagram.svelte.ts)"]
        N[nodes: DiagramNode[]]
        M[modules: ModuleDefinition[]]
        MI[moduleInstances: ModuleInstance[]]
    end

    subgraph CostPanel ["CostPanel.svelte"]
        VT[View Toggle: Category | Container | Module]
        BAR[CostDistributionBar.svelte]
        BL[Breakdown list — grouped rows + drill-down]
        EX[Export CSV]
    end

    subgraph NodeComponents ["Node Components"]
        MN[ModuleNode.svelte — cost badge NEW]
        CN[ContainerResourceNode.svelte — aggregate badge UPDATE]
    end

    E --> NEW1
    E --> NEW2
    N --> NEW1
    N --> NEW2
    M --> NEW2
    MI --> NEW2
    NEW1 --> BL
    NEW2 --> BL
    NEW1 --> BAR
    NEW2 --> BAR
    NEW1 --> EX
    NEW2 --> EX
    NEW1 --> CN
    NEW2 --> MN
```

### 4.2 Data Models / Interfaces

All additions are in `apps/desktop/src/lib/stores/cost.svelte.ts` unless noted.

```typescript
/**
 * A single group entry in the container or module breakdown views.
 * Replaces the inline object shape used by groupedEstimates in CostPanel today.
 */
export interface CostGroup {
  /** Stable identifier — nodeId for containers, moduleId/instanceId for modules */
  id: string;
  /** Display label shown in the panel */
  label: string;
  /** Sum of monthlyCost for all members where monthlyCost !== null */
  subtotal: number;
  /** True if at least one member has monthlyCost === null (usage-based) */
  hasUsageBased: boolean;
  /** Ordered member estimates within this group */
  members: CostEstimate[];
  /**
   * For module groups only: 'module' | 'template' | 'instance'.
   * Undefined for container groups.
   */
  moduleKind?: 'module' | 'template' | 'instance';
  /**
   * For template instances: the display name of the template they reference.
   * Shown as a subtitle under the instance label.
   */
  templateName?: string;
}

/**
 * Which view is active in the cost panel.
 * Stored as local $state in CostPanel — not persisted.
 */
export type CostView = 'category' | 'container' | 'module';
```

The existing `CostEstimate` interface in `cost.svelte.ts` gains no new fields; all grouping is
derived entirely from `DiagramNode` graph state.

### 4.3 Component Breakdown

#### 4.3.1 `CostStore` — new derived properties

Two new `$derived.by()` properties on the `CostStore` class:

**`containerGroups`**

Algorithm:
1. Filter nodes: exclude synthetic prefixes (`_mod_`, `_modinst_`, `_instmem_`), exclude
   container-type nodes themselves (their own cost is $0).
2. For each real resource node, walk `parentId` upward until finding a node whose `typeId` is a
   billing container type (`azurerm/core/resource_group`, `aws/networking/vpc`). Record that
   container's `id` and `label`.
3. Nodes with no billing container ancestor go into a virtual group with id `__unassigned__` and
   label `"Unassigned"`.
4. Build `CostGroup[]` sorted by `subtotal` descending; "Unassigned" always last.

```typescript
containerGroups = $derived.by((): CostGroup[] => {
  // Requires access to diagram.nodes — see Section 4.3.2 for injection pattern
  ...
});
```

**`moduleGroups`**

Algorithm:
1. Filter nodes: exclude synthetic prefixes.
2. For each node with `data.moduleId` set, associate it with the matching `ModuleDefinition`.
3. For nodes with no `moduleId`, place them in a virtual `__unassigned__` group.
4. Template instances (`ModuleInstance[]`) each get their own group entry using the instance
   `name` as label and `templateName` as subtitle. Members are resolved by expanding the template's
   member nodes.
5. Sort by `subtotal` descending; "Unassigned" last.

#### 4.3.2 Diagram dependency injection into CostStore

`CostStore` currently receives `DiagramNode[]` only via `fetchAll(nodes)` and `exportCsv(nodes)`.
The new `$derived` properties need continuous access to `diagram.nodes`, `diagram.modules`, and
`diagram.moduleInstances` without importing `diagram` directly into the store (to avoid circular
dependencies; `diagram.svelte.ts` already imports from `cost.svelte.ts` indirectly).

**Chosen approach: reactive injection via a `setDiagram()` method.**

```typescript
// In CostStore:
private _nodes = $state<DiagramNode[]>([]);
private _modules = $state<ModuleDefinition[]>([]);
private _moduleInstances = $state<ModuleInstance[]>([]);

/** Called once from bootstrap or a top-level $effect in App.svelte. */
setDiagramSource(
  nodes: () => DiagramNode[],
  modules: () => ModuleDefinition[],
  instances: () => ModuleInstance[]
): void {
  // Store getters; $derived.by() will re-run when these change
  this._nodes = nodes();
  this._modules = modules();
  this._moduleInstances = instances();
}
```

A top-level `$effect` in `apps/desktop/src/routes/+page.svelte` (or `App.svelte`, wherever
diagram is already live) keeps the injected values current:

```typescript
$effect(() => {
  cost.setDiagramSource(
    () => diagram.nodes,
    () => diagram.modules,
    () => diagram.moduleInstances
  );
});
```

Alternative (simpler): compute the groups inside `CostPanel.svelte` as local `$derived` values
rather than on the store, passing `nodes`, `modules`, and `moduleInstances` from `diagram` directly
in the component. This avoids the injection complexity entirely and is preferred for Phase 1
since the groups are only consumed by the panel. **Use this approach.** Move to store-level
derivation only if cost badges on nodes need the grouped data (Phase 2 cost badges can do their
own local derivation in the node components).

#### 4.3.3 `CostPanel.svelte` — view toggle and new sections

Add at the top of the panel (below the action bar, above the dirty banner):

```svelte
<div class="view-toggle">
  <button class:active={view === 'category'} onclick={() => view = 'category'}>Category</button>
  <button class:active={view === 'container'} onclick={() => view = 'container'}>Container</button>
  <button class:active={view === 'module'} onclick={() => view = 'module'}>Module</button>
</div>
```

`view` is `$state<CostView>('category')`. The toggle is hidden (rendered but `display: none`) when
`!cost.hasPrices`.

Replace the single `CollapsibleSection` for "By Resource Type" with a conditional render:

```svelte
{#if view === 'category'}
  <!-- existing groupedEstimates rendering, unchanged -->
{:else if view === 'container'}
  <CostGroupList groups={containerGroups} {expandedIds} onToggle={toggleExpanded} />
{:else}
  <CostGroupList groups={moduleGroups} {expandedIds} onToggle={toggleExpanded} />
{/if}
```

`expandedIds` is `$state<Set<string>>(new Set())` — independent of the view so users can keep
groups open as they switch tabs.

#### 4.3.4 `CostDistributionBar.svelte` — new component

A pure presentational component. Props:

```typescript
interface Props {
  groups: CostGroup[];
  /** Maximum number of labeled segments; remainder becomes "Other" */
  maxSegments?: number; // default 6
  total: number | null;
}
```

Renders a full-width `<div>` with flex children. Each child's `flex-grow` is proportional to its
`subtotal / total`. Colors cycle through a fixed palette of 6 CSS custom properties (easily
themeable). A tooltip on hover shows the exact subtotal.

If `total` is null or 0, the bar is not rendered (returns empty).

The component is placed inside the Summary `CollapsibleSection`, between the summary grid and the
Export CSV button. It receives the active view's groups — category, container, or module — so it
always reflects the current breakdown view.

#### 4.3.5 `CostGroupList.svelte` — new component

Extracted from the existing inline rendering in `CostPanel.svelte`. Receives:

```typescript
interface Props {
  groups: CostGroup[];
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  totalMonthly: number | null;
}
```

Renders one row per group (label, percentage, subtotal) and, when the group is in `expandedIds`,
the individual resource rows indented below it. The group header row is a `<button>` element with
`aria-expanded`. Individual resource rows are identical in markup to the existing `.resource-row`
elements in `CostPanel.svelte`.

For module groups with `moduleKind === 'instance'`, render `templateName` as a muted subtitle
below the instance label.

#### 4.3.6 `ModuleNode.svelte` — cost badge

Add cost awareness using the same pattern as `ContainerResourceNode.svelte`:

```typescript
import { cost } from '$lib/stores/cost.svelte';
import { ui } from '$lib/stores/ui.svelte';

// Sum costs of all non-synthetic member nodes belonging to this module
const moduleCost = $derived.by(() => {
  if (!ui.showCostBadges || !moduleId) return null;
  const memberIds = new Set(
    diagram.nodes
      .filter((n) => n.data.moduleId === moduleId && !n.id.startsWith('_'))
      .map((n) => n.id)
  );
  let total = 0;
  let hasAny = false;
  for (const id of memberIds) {
    const est = cost.estimates.get(id);
    if (est?.monthlyCost != null) { total += est.monthlyCost; hasAny = true; }
  }
  return hasAny ? total : null;
});

const moduleCostLabel = $derived.by(() => {
  if (moduleCost === null) return null;
  if (moduleCost === 0) return null;
  return moduleCost < 10 ? `~$${moduleCost.toFixed(2)}/mo` : `~$${Math.round(moduleCost)}/mo`;
});
```

Render the badge in the module node header, after the member count badge:

```svelte
{#if moduleCostLabel}
  <span class="cost-chip">{moduleCostLabel}</span>
{/if}
```

Style `.cost-chip` consistently with the existing chip in `ContainerResourceNode.svelte`.

#### 4.3.7 `ContainerResourceNode.svelte` — aggregate cost badge

The existing `costLabel` derived value reads only the container's own estimate
(`cost.estimates.get(id)`), which is always `$0` for Resource Groups and VPCs.

Replace with an aggregate calculation that sums all descendant resource costs:

```typescript
// Replace existing costEstimate / costLabel derived values:
const aggregateCost = $derived.by(() => {
  if (!ui.showCostBadges) return null;
  // Collect all nodes whose parentId chain leads to this container
  function isDescendant(nodeId: string): boolean {
    let cur = diagram.nodes.find((n) => n.id === nodeId);
    while (cur?.parentId) {
      if (cur.parentId === id) return true;
      cur = diagram.nodes.find((n) => n.id === cur!.parentId);
    }
    return false;
  }
  let total = 0;
  let hasAny = false;
  for (const node of diagram.nodes) {
    if (node.id.startsWith('_')) continue;
    if (!isDescendant(node.id)) continue;
    const est = cost.estimates.get(node.id);
    if (est?.monthlyCost != null) { total += est.monthlyCost; hasAny = true; }
  }
  return hasAny ? total : null;
});

const costLabel = $derived.by(() => {
  if (aggregateCost === null) return null;
  if (aggregateCost === 0) return null;
  return aggregateCost < 10
    ? `~$${aggregateCost.toFixed(2)}/mo`
    : `~$${Math.round(aggregateCost)}/mo`;
});
```

Note: the `isDescendant` walk is O(depth) per node. For diagrams with hundreds of nodes this is
acceptable; if profiling shows it is a bottleneck, replace with a precomputed descendant set
(see Section 6).

#### 4.3.8 `CostStore.exportCsv()` — enhanced

Extend the signature:

```typescript
exportCsv(
  nodes: DiagramNode[],
  options?: {
    groupBy?: 'category' | 'container' | 'module';
    groups?: CostGroup[];
  }
): string
```

When `groupBy` and `groups` are provided, the CSV gains a `"Group"` column as the second field:

```
Resource Name,Group,Type,Est. Monthly Cost (USD),Notes
"my-vm","rg-production","virtual_machine","$73.00",""
"my-db","rg-production","mssql_database","$150.00",""
...
"TOTAL",,,"$223.00","Excludes usage-based resources"
```

The existing zero-argument behavior (no `options`) is unchanged for backward compatibility.

The `handleExportCsv` function in `CostPanel.svelte` passes the current `view` and active groups.

### 4.4 API / Contract Changes

No changes to `@terrastudio/types` or any plugin interfaces. All changes are confined to:

- `apps/desktop/src/lib/stores/cost.svelte.ts` — new `CostGroup` interface (exported),
  extended `exportCsv` signature
- `apps/desktop/src/lib/components/CostPanel.svelte` — view toggle, new derived groupings,
  updated export call
- `apps/desktop/src/lib/components/ContainerResourceNode.svelte` — aggregate cost logic
- `apps/desktop/src/lib/components/ModuleNode.svelte` — cost badge addition
- New files: `CostDistributionBar.svelte`, `CostGroupList.svelte`

---

## 5. Implementation Plan

### 5.1 Phases

#### Phase 1 — Container and Module grouping in the panel (core feature)

Deliverables:
- `CostGroup` interface exported from `cost.svelte.ts`
- Extended `exportCsv()` with optional `groupBy` + `groups` parameters
- View toggle state (`CostView`) in `CostPanel.svelte`
- Container grouping derivation in `CostPanel.svelte`
- Module grouping derivation in `CostPanel.svelte` (regular modules + template instances)
- `CostGroupList.svelte` component
- Enhanced CSV export
- Updated `handleExportCsv` in `CostPanel.svelte`

#### Phase 2 — Visual distribution bar

Deliverables:
- `CostDistributionBar.svelte` component
- Integration into `CostPanel.svelte` Summary section
- Bar updates reactively when view toggle changes

#### Phase 3 — Cost badges on module and container nodes

Deliverables:
- Aggregate cost derivation in `ContainerResourceNode.svelte`
- Cost badge in `ModuleNode.svelte`
- Verify badge behavior under `ui.showCostBadges` toggle
- Test with collapsed module nodes and deeply nested Azure resource hierarchies

### 5.2 File Changes

| Action   | File                                                                                           | Notes                                                         |
|----------|------------------------------------------------------------------------------------------------|---------------------------------------------------------------|
| Modify   | `apps/desktop/src/lib/stores/cost.svelte.ts`                                                   | Export `CostGroup`, `CostView`; extend `exportCsv`            |
| Modify   | `apps/desktop/src/lib/components/CostPanel.svelte`                                             | View toggle, container/module grouping, distribution bar slot |
| Modify   | `apps/desktop/src/lib/components/ContainerResourceNode.svelte`                                 | Aggregate descendant cost; replace `costEstimate` derivation  |
| Modify   | `apps/desktop/src/lib/components/ModuleNode.svelte`                                            | Import `cost`, `ui`; add `moduleCost` derivation + badge      |
| Create   | `apps/desktop/src/lib/components/CostDistributionBar.svelte`                                   | New proportional bar chart component                          |
| Create   | `apps/desktop/src/lib/components/CostGroupList.svelte`                                         | New reusable group list component                             |

### 5.3 Dependencies

No new npm packages required. The feature uses only:
- Existing Svelte 5 runes (`$state`, `$derived`, `$derived.by`)
- Existing stores (`cost`, `diagram`, `ui`)
- Existing CSS custom properties (`--color-accent`, `--color-border`, `--color-surface`, etc.)

---

## 6. Edge Cases & Error Handling

**Resources with no billing container ancestor (Azure)**
Place them in `__unassigned__` group. This covers: resources added to the canvas but not yet
dragged into a Resource Group, and Subscription-level resources. Label as "Unassigned".

**Resources belonging to a module AND a container**
Both views are independent. In Container view, the resource counts toward its container group. In
Module view, it counts toward its module group. No double-counting occurs because the views are
mutually exclusive tabs.

**Template instances with no cost estimates**
If a template has no members with known prices (all usage-based or unresolved), the instance group
renders with subtotal `$0` and a muted "usage-based" note. It is still listed so users are aware
of the boundary.

**Synthetic node IDs (`_mod_`, `_modinst_`, `_instmem_`)**
All grouping functions must guard with `node.id.startsWith('_')` before processing. These nodes
have no `CostEstimate` entries (they are filtered from `cost.fetchAll` callers) but may appear in
`diagram.nodes` and would produce undefined lookups if not excluded.

**Cost not yet fetched (empty estimates map)**
The view toggle is hidden when `!cost.hasPrices`. Container/module groupings return empty arrays.
No empty-state special-casing needed inside the group components beyond the existing empty-state
block in `CostPanel.svelte`.

**Large diagrams with deep nesting (ContainerResourceNode aggregate cost)**
The `isDescendant` walk is O(nodes × depth). For typical diagrams (< 200 nodes, depth ≤ 4) this
is negligible. If it becomes a bottleneck, precompute a `childrenMap: Map<string, string[]>` once
per `diagram.nodes` change and use DFS from the container's id instead.

**Module instance cost when template members share IDs with real diagram nodes**
Template member node IDs are unique per diagram. Instance expansion clones use `_instmem_` prefix
and are excluded by the synthetic ID guard. Per-instance cost is the sum of the template members'
estimates (shared across all instances of the same template). This is a known approximation — each
instance in production would have its own independently priced resources, but in the diagram they
share one set of estimates. Document this in the Notes section of the cost panel.

**Zero-subtotal groups**
Groups where all members are free ($0) or usage-based (null) are shown with subtotal `Free` or
`—` respectively. They are sorted after priced groups to keep high-cost groups visible at the top.

---

## 7. Testing Strategy

### Unit / logic tests

- Container grouping algorithm: given a flat array of mock `DiagramNode` objects with varying
  `parentId` chains and `typeId` values, assert that each node lands in the correct group and that
  unparented nodes go to `__unassigned__`.
- Module grouping algorithm: given nodes with `moduleId` set, assert correct group membership;
  assert template instances produce separate group rows with correct `templateName`.
- `exportCsv` with `groupBy: 'container'`: assert CSV has a "Group" column and correct row data.
- Synthetic ID filter: nodes whose IDs begin with `_` must not appear in any group's `members`.

### Component / integration tests (Playwright or manual)

- Open a diagram with two Azure Resource Groups each containing 2–3 resources; fetch prices;
  switch to Container view — verify two groups with correct subtotals appear.
- Create a module with 3 resources; fetch prices; switch to Module view — verify the module group
  appears with the sum of its members' costs.
- Collapse a module on the canvas; verify the cost badge appears on the `ModuleNode` chip.
- Toggle `showCostBadges` off — verify the badge disappears from both module and container nodes.
- Open a multi-RG diagram; verify the cost-distribution bar segments are proportional to the
  RG subtotals.
- Click a group header to expand drill-down; verify individual resource rows appear; click again
  to collapse.
- Export CSV in Container view; open in a spreadsheet; verify "Group" column is present.

### Manual regression

- Verify the existing "By Category" (renamed from "By Resource Type") view is visually and
  functionally unchanged.
- Verify the dirty-banner still appears after changing a resource property in any view.
- Verify cost badges on leaf nodes (`DefaultResourceNode`) are unaffected.

---

## 8. Security & Performance Considerations

**Performance**

- All new computation is pure `$derived` from in-memory state — no additional network requests.
- The `isDescendant` walk in `ContainerResourceNode` runs once per node per `diagram.nodes`
  reactivity update. With Svelte 5's fine-grained reactivity this only re-runs when `diagram.nodes`
  changes, not on every render tick.
- `CostDistributionBar` renders at most 7 DOM elements (6 segments + "Other") regardless of
  diagram size. No virtualization needed.
- Module grouping iterates `diagram.nodes` once — O(n). Container grouping walks the parent chain
  per node — O(n × depth), worst case O(n²) for very deep nesting but bounded by a maximum tree
  depth of ~5 in realistic Azure diagrams.

**Security**

- No new Tauri commands, no new IPC surface, no new file I/O.
- The enhanced CSV export writes to a Blob URL in the browser context (existing pattern); no path
  traversal risk.
- Cost data is read-only derived state; no user input flows back into pricing calculations.

---

## 9. Open Questions

1. **"By Resource Type" rename**: The current section label in the panel is "By Resource Type".
   With the new toggle, should it become "Category" (matching the toggle button label) or stay as
   "By Resource Type" for continuity? Decision needed before Phase 1 ships.

2. **Distribution bar placement**: The bar is proposed inside the Summary collapsible section.
   An alternative is a persistent strip between the summary section and the breakdown list (always
   visible, not inside a collapsible). Preference?

3. **Unassigned group visibility**: Should the `__unassigned__` group be hidden when it is empty
   (all resources are accounted for by a container/module), or always shown as a confirmation that
   nothing is unaccounted for? Hiding it is cleaner; always showing it is more explicit.

4. **Template instance cost note**: Each template instance shows cost based on the shared template
   member estimates. This is a known approximation (all instances show the same cost). Should the
   panel show a tooltip or inline note warning about this? Recommended: yes, a `(i)` icon on
   instance rows linking to a note in the Notes section.

5. **ModuleInstanceNode badge**: `ModuleInstanceNode.svelte` (the expanded instance card) is
   distinct from `ModuleNode.svelte` (the collapsed placeholder). Should instance cards also show
   a cost badge? Out of scope for Phase 3 as specified, but worth confirming.

---

## 10. References

- Existing cost store: `apps/desktop/src/lib/stores/cost.svelte.ts`
- Existing cost calculators: `apps/desktop/src/lib/cost/index.ts`
- Existing cost panel: `apps/desktop/src/lib/components/CostPanel.svelte`
- Container node component: `apps/desktop/src/lib/components/ContainerResourceNode.svelte`
- Module node component: `apps/desktop/src/lib/components/ModuleNode.svelte`
- Module types: `packages/types/src/module.ts`
- Node data types: `packages/types/src/node.ts`
- UI store (showCostBadges): `apps/desktop/src/lib/stores/ui.svelte.ts`
- Synthetic node prefix documentation: `CLAUDE.md` → "Synthetic node prefixes"
- SPEC-001 (bottom-panel-system): `docs/specs/bottom-panel-system.md`
