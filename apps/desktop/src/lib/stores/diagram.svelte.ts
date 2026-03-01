import type { Node, Edge } from '@xyflow/svelte';
import type { ResourceNodeData, ResourceTypeId, ValidationError, TerraStudioEdgeData, EdgeCategoryId, ReferenceEdgeOverrides, HandleDefinition, ModuleDefinition } from '@terrastudio/types';
import { generateNodeId, generateUniqueTerraformName } from '@terrastudio/core';
import { project } from './project.svelte';
import { terraform } from './terraform.svelte';
import { registry } from '$lib/bootstrap';
import { ui } from './ui.svelte';

export type DiagramNode = Node<ResourceNodeData>;
export type DiagramEdge = Edge<TerraStudioEdgeData>;

interface DiagramSnapshot {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  modules: ModuleDefinition[];
}

const MAX_HISTORY = 50;

/** Generate a "(copy)" / "(copy 2)" label for pasted nodes. */
function generateCopyLabel(label: string): string {
  const match = label.match(/^(.+?) \(copy(?: (\d+))?\)$/);
  if (match) {
    const base = match[1];
    const num = match[2] ? parseInt(match[2], 10) + 1 : 2;
    return `${base} (copy ${num})`;
  }
  return `${label} (copy)`;
}

class DiagramStore {
  nodes = $state<DiagramNode[]>([]);
  edges = $state<DiagramEdge[]>([]);
  modules = $state<ModuleDefinition[]>([]);

  selectedNodeId = $state<string | null>(null);
  selectedEdgeId = $state<string | null>(null);
  selectedModuleId = $state<string | null>(null);

  /**
   * Auto-generated visual-only edges for reference properties marked showAsEdge: true.
   * These are never stored in `edges` — they are derived and rendered via displayEdges in DnDFlow.
   * They are selectable so users can add labels/style overrides, but not deletable.
   */
  referenceEdges = $derived.by((): DiagramEdge[] => {
    const result: DiagramEdge[] = [];
    for (const node of this.nodes) {
      const schema = registry.getResourceSchema(node.type as ResourceTypeId);
      if (!schema) continue;
      const overrides = (node.data.referenceEdgeOverrides as ReferenceEdgeOverrides) ?? {};
      for (const prop of schema.properties) {
        if (prop.type !== 'reference' || !prop.showAsEdge) continue;
        const targetId = node.data.references[prop.key] as string | undefined;
        if (!targetId) continue;
        const targetNode = this.nodes.find((n) => n.id === targetId);
        if (!targetNode) continue;

        // Use convention-based handle IDs so every showAsEdge property gets
        // a dedicated source handle on the source node (ref-{propKey}) and,
        // if the target schema has a matching pep-target handle, a target handle.
        const sourceHandleId = `ref-${prop.key}`;

        // Find a matching target handle on the target node.
        // Priority: first non-output target handle (e.g., pep-target, vnet-int-target).
        const targetSchema = registry.getResourceSchema(targetNode.type as ResourceTypeId);
        const targetHandles = targetSchema?.handles?.filter((h: HandleDefinition) => h.type === 'target') ?? [];
        const targetHandle = targetHandles.length > 0 ? targetHandles[0] : undefined;

        const edgeOverride = overrides[prop.key];
        result.push({
          id: `ref-${node.id}-${prop.key}`,
          source: node.id,
          sourceHandle: sourceHandleId,
          target: targetId,
          targetHandle: targetHandle?.id,
          deletable: false,
          selectable: true,
          data: {
            category: 'reference',
            sourceProperty: prop.key,
            label: edgeOverride?.label,
            styleOverrides: edgeOverride?.styleOverrides,
          },
        });
      }
    }
    return result;
  });

  // Undo/redo history — each entry is a complete state snapshot.
  // historyIndex points to the entry representing the current state.
  private history = $state<DiagramSnapshot[]>([]);
  private historyIndex = $state(-1);
  private skipHistory = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  canUndo = $derived(this.historyIndex > 0);
  canRedo = $derived(this.historyIndex < this.history.length - 1);

  // Clipboard for copy/paste
  private clipboard = $state<{ nodes: DiagramNode[]; edges: DiagramEdge[] } | null>(null);
  hasClipboard = $derived(this.clipboard !== null && this.clipboard.nodes.length > 0);

  selectedNode = $derived(
    this.selectedNodeId
      ? this.nodes.find((n) => n.id === this.selectedNodeId) ?? null
      : null
  );

  selectedEdge = $derived(
    this.selectedEdgeId
      ? this.edges.find((e) => e.id === this.selectedEdgeId)
        ?? this.referenceEdges.find((e) => e.id === this.selectedEdgeId)
        ?? null
      : null
  );

  selectedModule = $derived(
    this.selectedModuleId
      ? this.modules.find((m) => m.id === this.selectedModuleId) ?? null
      : null
  );

  private takeSnapshot(): DiagramSnapshot {
    const nodesSnap = $state.snapshot(this.nodes) as unknown;
    const edgesSnap = $state.snapshot(this.edges) as unknown;
    const modulesSnap = $state.snapshot(this.modules) as unknown;
    return {
      nodes: structuredClone(nodesSnap) as DiagramNode[],
      edges: structuredClone(edgesSnap) as DiagramEdge[],
      modules: structuredClone(modulesSnap) as ModuleDefinition[],
    };
  }

  /** Ensure history has an initial entry for the pre-mutation state. */
  private ensureInitialSnapshot() {
    if (this.history.length > 0) return;
    this.history = [this.takeSnapshot()];
    this.historyIndex = 0;
  }

  /** Push current state onto history. Call AFTER performing a mutation. */
  private pushSnapshot() {
    if (this.skipHistory) return;
    project.markDirty();
    terraform.markFilesStale();

    // Discard any future history (redo branch) if we're not at the end
    const newHistory = this.history.slice(0, this.historyIndex + 1);

    newHistory.push(this.takeSnapshot());

    // Cap history size
    if (newHistory.length > MAX_HISTORY) {
      newHistory.shift();
    }

    this.history = newHistory;
    this.historyIndex = newHistory.length - 1;
  }

  /** Flush any pending debounced snapshot (e.g. from typing in property fields). */
  private flushPendingSnapshot() {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
      this.pushSnapshot();
    }
  }

  /** Save current state to history (call after external mutations like drag stop). */
  saveSnapshot() {
    this.flushPendingSnapshot();
    this.ensureInitialSnapshot();
    this.pushSnapshot();
  }

  undo() {
    this.flushPendingSnapshot();
    if (!this.canUndo) return;
    this.historyIndex--;
    this.restoreSnapshot(this.history[this.historyIndex]);
    project.markDirty();
  }

  redo() {
    this.flushPendingSnapshot();
    if (!this.canRedo) return;
    this.historyIndex++;
    this.restoreSnapshot(this.history[this.historyIndex]);
    project.markDirty();
  }

  private restoreSnapshot(snapshot: DiagramSnapshot) {
    this.skipHistory = true;
    // snapshot is a reactive proxy (from $state history array), unwrap before cloning
    const nodesSnap = $state.snapshot(snapshot.nodes) as unknown;
    const edgesSnap = $state.snapshot(snapshot.edges) as unknown;
    const modulesSnap = $state.snapshot(snapshot.modules ?? []) as unknown;
    this.nodes = structuredClone(nodesSnap) as DiagramNode[];
    this.edges = structuredClone(edgesSnap) as DiagramEdge[];
    this.modules = structuredClone(modulesSnap) as ModuleDefinition[];
    this.selectedNodeId = null;
    this.selectedEdgeId = null;
    this.selectedModuleId = null;
    this.skipHistory = false;
  }

  addNode(node: DiagramNode) {
    this.flushPendingSnapshot();
    this.ensureInitialSnapshot();
    this.nodes = [...this.nodes, node];
    this.pushSnapshot();
  }

  removeNode(id: string) {
    this.flushPendingSnapshot();
    this.ensureInitialSnapshot();

    // Collect the node and all its descendants
    const toRemove = new Set<string>([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const n of this.nodes) {
        if (!toRemove.has(n.id) && n.parentId && toRemove.has(n.parentId as string)) {
          toRemove.add(n.id);
          changed = true;
        }
      }
    }

    this.nodes = this.nodes.filter((n) => !toRemove.has(n.id));
    this.edges = this.edges.filter((e) => !toRemove.has(e.source) && !toRemove.has(e.target));
    for (const removedId of toRemove) {
      this.cleanStaleReferences(removedId);
    }
    if (this.selectedNodeId && toRemove.has(this.selectedNodeId)) {
      this.selectedNodeId = null;
    }
    this.pushSnapshot();
  }

  updateNodeData(id: string, data: Partial<ResourceNodeData>) {
    this.ensureInitialSnapshot();

    // Cancel any pending debounced snapshot (we'll start a new debounce)
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }

    project.markDirty();
    terraform.markFilesStale();

    this.nodes = this.nodes.map((n) =>
      n.id === id ? { ...n, data: { ...n.data, ...data } } : n
    );

    // Debounce: coalesce rapid property edits (typing) into one undo step
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.pushSnapshot();
    }, 500);
  }

  addEdge(edge: DiagramEdge) {
    this.flushPendingSnapshot();
    this.ensureInitialSnapshot();
    // Replace any auto-added edge with the same endpoints (SvelteFlow bind:edges may auto-add)
    this.edges = [
      ...this.edges.filter(
        (e) =>
          !(
            e.source === edge.source &&
            e.target === edge.target &&
            e.sourceHandle === edge.sourceHandle &&
            e.targetHandle === edge.targetHandle
          ),
      ),
      edge,
    ];
    this.pushSnapshot();
  }

  updateEdgeLabel(edgeId: string, label: string) {
    // Check if this is a reference edge (format: ref-{nodeId}-{propKey})
    if (edgeId.startsWith('ref-')) {
      this.updateReferenceEdgeData(edgeId, { label });
      return;
    }

    this.ensureInitialSnapshot();

    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }

    project.markDirty();

    // Update label in edge.data (TerraStudioEdgeData)
    this.edges = this.edges.map((e) =>
      e.id === edgeId
        ? { ...e, data: { ...e.data, label } } as DiagramEdge
        : e
    );

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.pushSnapshot();
    }, 500);
  }

  updateEdgeData(edgeId: string, updates: Partial<TerraStudioEdgeData>) {
    // Check if this is a reference edge (format: ref-{nodeId}-{propKey})
    if (edgeId.startsWith('ref-')) {
      this.updateReferenceEdgeData(edgeId, updates);
      return;
    }

    this.ensureInitialSnapshot();
    project.markDirty();

    this.edges = this.edges.map((e) =>
      e.id === edgeId
        ? { ...e, data: { ...e.data, ...updates } } as DiagramEdge
        : e
    );

    this.pushSnapshot();
  }

  /**
   * Update customizations for a reference edge (stored on source node).
   * Reference edges are derived, so customizations (label, styleOverrides) are
   * stored in node.data.referenceEdgeOverrides.
   */
  private updateReferenceEdgeData(edgeId: string, updates: Partial<TerraStudioEdgeData>) {
    // Parse edge ID: ref-{nodeId}-{propKey}
    const match = edgeId.match(/^ref-(.+)-([^-]+)$/);
    if (!match) return;
    const [, nodeId, propKey] = match;

    this.ensureInitialSnapshot();

    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }

    project.markDirty();

    this.nodes = this.nodes.map((n) => {
      if (n.id !== nodeId) return n;
      const currentOverrides = (n.data.referenceEdgeOverrides as ReferenceEdgeOverrides) ?? {};
      const currentEdgeOverride = currentOverrides[propKey] ?? {};
      const newEdgeOverride = {
        ...currentEdgeOverride,
        ...(updates.label !== undefined ? { label: updates.label } : {}),
        ...(updates.styleOverrides !== undefined ? { styleOverrides: updates.styleOverrides } : {}),
      };
      // Clean up empty overrides
      if (!newEdgeOverride.label && !newEdgeOverride.styleOverrides) {
        const { [propKey]: _, ...rest } = currentOverrides;
        return {
          ...n,
          data: {
            ...n.data,
            referenceEdgeOverrides: Object.keys(rest).length > 0 ? rest : undefined,
          },
        };
      }
      return {
        ...n,
        data: {
          ...n.data,
          referenceEdgeOverrides: {
            ...currentOverrides,
            [propKey]: newEdgeOverride,
          },
        },
      };
    });

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.pushSnapshot();
    }, 500);
  }

  removeSelectedNodes() {
    const toRemove = new Set(this.nodes.filter((n) => n.selected).map((n) => n.id));
    if (toRemove.size === 0) return;

    // Expand to include all descendants of selected containers
    let changed = true;
    while (changed) {
      changed = false;
      for (const n of this.nodes) {
        if (!toRemove.has(n.id) && n.parentId && toRemove.has(n.parentId as string)) {
          toRemove.add(n.id);
          changed = true;
        }
      }
    }

    this.flushPendingSnapshot();
    this.ensureInitialSnapshot();
    this.nodes = this.nodes.filter((n) => !toRemove.has(n.id));
    this.edges = this.edges.filter((e) => !toRemove.has(e.source) && !toRemove.has(e.target));
    for (const deletedId of toRemove) {
      this.cleanStaleReferences(deletedId);
    }
    this.selectedNodeId = null;
    this.pushSnapshot();
  }

  /**
   * Count child nodes (recursively) for a set of node IDs.
   * Only counts children that are NOT already in the set.
   */
  private countChildren(nodeIds: Set<string>): number {
    let count = 0;
    for (const n of this.nodes) {
      if (nodeIds.has(n.id)) continue;
      if (n.parentId && nodeIds.has(n.parentId as string)) count++;
    }
    // Also count deeper descendants
    const allIds = new Set(nodeIds);
    let changed = true;
    while (changed) {
      changed = false;
      for (const n of this.nodes) {
        if (allIds.has(n.id)) continue;
        if (n.parentId && allIds.has(n.parentId as string)) {
          allIds.add(n.id);
          count++;
          changed = true;
        }
      }
    }
    // Subtract direct children already counted in first pass
    return allIds.size - nodeIds.size;
  }

  /**
   * Delete a node, prompting for confirmation if it has children.
   */
  async confirmAndRemoveNode(id: string) {
    const childCount = this.countChildren(new Set([id]));
    if (childCount > 0) {
      const confirmed = await ui.confirm({
        title: 'Delete Container',
        message: `This will also delete ${childCount} child resource${childCount > 1 ? 's' : ''} inside this container. Are you sure?`,
        confirmLabel: 'Delete All',
        danger: true,
      });
      if (!confirmed) return;
    }
    this.removeNode(id);
  }

  /**
   * Delete selected nodes, prompting for confirmation if any have children.
   */
  async confirmAndRemoveSelectedNodes() {
    const selectedIds = new Set(this.nodes.filter((n) => n.selected).map((n) => n.id));
    if (selectedIds.size === 0) return;

    const childCount = this.countChildren(selectedIds);
    if (childCount > 0) {
      const confirmed = await ui.confirm({
        title: 'Delete Containers',
        message: `This will also delete ${childCount} child resource${childCount > 1 ? 's' : ''} inside the selected containers. Are you sure?`,
        confirmLabel: 'Delete All',
        danger: true,
      });
      if (!confirmed) return;
    }
    this.removeSelectedNodes();
  }

  /** Remove references pointing to a deleted node from all remaining nodes. */
  private cleanStaleReferences(deletedId: string) {
    this.nodes = this.nodes.map((n) => {
      const refs = n.data.references;
      const hasStale = Object.values(refs).includes(deletedId);
      if (!hasStale) return n;
      const cleaned = { ...refs };
      for (const [k, v] of Object.entries(cleaned)) {
        if (v === deletedId) delete cleaned[k];
      }
      return { ...n, data: { ...n.data, references: cleaned } };
    });
  }

  removeEdge(id: string) {
    this.flushPendingSnapshot();
    this.ensureInitialSnapshot();
    this.edges = this.edges.filter((e) => e.id !== id);
    this.pushSnapshot();
  }

  /**
   * Update the real edges array from DnDFlow's displayEdges sync effect.
   * Only pushes a history snapshot when edges are structurally added/removed
   * (not for selection-state-only changes).
   */
  setEdges(edges: DiagramEdge[]) {
    const prev = this.edges;
    const idsChanged =
      edges.length !== prev.length || edges.some((e, i) => e.id !== prev[i]?.id);
    this.edges = edges;
    if (idsChanged) {
      this.flushPendingSnapshot();
      this.ensureInitialSnapshot();
      this.pushSnapshot();
    }
  }

  /**
   * Copy specified nodes (and their children/internal edges) to the clipboard.
   */
  copyNodes(nodeIds: string[]) {
    const idSet = new Set(nodeIds);

    // Recursively collect children whose parent is in the set
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

    const copiedNodes = this.nodes.filter((n) => idSet.has(n.id));
    const copiedEdges = this.edges.filter(
      (e) => idSet.has(e.source) && idSet.has(e.target),
    );

    // Deep clone via snapshot + structuredClone to strip reactivity
    const nodesSnap = $state.snapshot(copiedNodes) as unknown;
    const edgesSnap = $state.snapshot(copiedEdges) as unknown;
    this.clipboard = {
      nodes: structuredClone(nodesSnap) as DiagramNode[],
      edges: structuredClone(edgesSnap) as DiagramEdge[],
    };
  }

  /**
   * Paste nodes from clipboard with new IDs, offset positions, and unique names.
   */
  pasteNodes() {
    if (!this.clipboard || this.clipboard.nodes.length === 0) return;

    this.flushPendingSnapshot();
    this.ensureInitialSnapshot();

    const oldToNew = new Map<string, string>();
    const existingNames = new Set(this.nodes.map((n) => n.data.terraformName));

    // Generate new IDs for each clipboard node
    for (const node of this.clipboard.nodes) {
      const newId = generateNodeId(node.type as ResourceTypeId);
      oldToNew.set(node.id, newId);
    }

    const newNodes: DiagramNode[] = [];
    for (const node of this.clipboard.nodes) {
      const newId = oldToNew.get(node.id)!;
      const newTfName = generateUniqueTerraformName(
        node.data.terraformName,
        existingNames,
      );
      existingNames.add(newTfName);

      // Generate copy label
      const label = generateCopyLabel(node.data.label);

      // Remap parentId (only if parent was also copied)
      const remappedParentId = node.parentId
        ? oldToNew.get(node.parentId as string)
        : undefined;

      // Remap references (keep only those pointing to copied nodes)
      const remappedRefs: Record<string, string> = {};
      for (const [key, refId] of Object.entries(node.data.references)) {
        const newRef = oldToNew.get(refId as string);
        if (newRef) remappedRefs[key] = newRef;
      }

      const newNode: DiagramNode = {
        ...structuredClone($state.snapshot(node) as unknown) as DiagramNode,
        id: newId,
        position: {
          x: node.position.x + 30,
          y: node.position.y + 30,
        },
        data: {
          ...node.data,
          terraformName: newTfName,
          label,
          references: remappedRefs,
          validationErrors: [],
        },
        selected: true,
      };

      if (remappedParentId) {
        newNode.parentId = remappedParentId;
      } else {
        delete (newNode as any).parentId;
        delete (newNode as any).extent;
      }

      newNodes.push(newNode);
    }

    const newEdges: DiagramEdge[] = [];
    for (const edge of this.clipboard.edges) {
      const newSource = oldToNew.get(edge.source);
      const newTarget = oldToNew.get(edge.target);
      if (!newSource || !newTarget) continue;

      newEdges.push({
        ...edge,
        id: `e-${newSource}-${edge.sourceHandle ?? 'default'}-${newTarget}`,
        source: newSource,
        target: newTarget,
      });
    }

    // Deselect existing nodes, add new ones
    this.nodes = [
      ...this.nodes.map((n) => ({ ...n, selected: false })),
      ...newNodes,
    ];
    this.edges = [...this.edges, ...newEdges];

    this.selectedNodeId = null;
    this.pushSnapshot();
  }

  selectAll() {
    this.nodes = this.nodes.map((n) => ({ ...n, selected: true }));
  }

  /**
   * Set validation errors on a single node.
   * Does NOT mark the project dirty, files stale, or create undo history —
   * validation errors are transient UI state that must not trigger auto-regen.
   */
  setNodeValidationErrors(id: string, errors: ValidationError[]) {
    this.nodes = this.nodes.map((n) =>
      n.id === id ? { ...n, data: { ...n.data, validationErrors: errors } } : n
    );
  }

  /**
   * Clear validation errors from all nodes.
   * Same no-side-effects contract as setNodeValidationErrors.
   */
  clearAllValidationErrors() {
    this.nodes = this.nodes.map((n) =>
      (n.data.validationErrors as unknown[])?.length
        ? { ...n, data: { ...n.data, validationErrors: [] } }
        : n
    );
  }

  /** Load a saved diagram without marking dirty or pushing per-node history. */
  loadDiagram(nodes: DiagramNode[], edges: DiagramEdge[], modules?: ModuleDefinition[]) {
    this.skipHistory = true;
    const cloned = structuredClone(nodes);
    // Validate parentId constraints — strip invalid containment relationships
    for (const node of cloned) {
      if (!node.parentId) continue;
      const childSchema = registry.getResourceSchema(node.type as ResourceTypeId);
      const allowedParents = childSchema?.canBeChildOf;
      if (!allowedParents || allowedParents.length === 0) {
        delete (node as any).parentId;
        continue;
      }
      const parent = cloned.find((n) => n.id === node.parentId);
      if (!parent || !allowedParents.includes(parent.type as ResourceTypeId)) {
        delete (node as any).parentId;
      }
    }
    this.nodes = cloned;
    this.edges = structuredClone(edges);
    this.modules = structuredClone(modules ?? []);
    this.selectedNodeId = null;
    this.selectedModuleId = null;
    this.skipHistory = false;
    // Set initial history snapshot
    this.history = [this.takeSnapshot()];
    this.historyIndex = 0;
  }

  // ── Module CRUD methods ──────────────────────────────────────────

  /**
   * Create a module from selected node IDs.
   * Assigns moduleId to the given nodes and creates a ModuleDefinition.
   * Returns the new module's ID.
   */
  createModule(name: string, nodeIds: string[]): string {
    this.flushPendingSnapshot();
    this.ensureInitialSnapshot();

    const id = `mod-${crypto.randomUUID().slice(0, 8)}`;

    // Compute initial position from the bounding box of member nodes
    const memberNodes = this.nodes.filter((n) => nodeIds.includes(n.id));
    const minX = Math.min(...memberNodes.map((n) => n.position.x));
    const minY = Math.min(...memberNodes.map((n) => n.position.y));

    const mod: ModuleDefinition = {
      id,
      name,
      collapsed: false,
      position: { x: minX - 20, y: minY - 40 },
    };

    this.modules = [...this.modules, mod];
    this.nodes = this.nodes.map((n) =>
      nodeIds.includes(n.id) ? { ...n, data: { ...n.data, moduleId: id } } : n,
    );

    this.pushSnapshot();
    return id;
  }

  /**
   * Delete a module. Clears moduleId from all member nodes but does NOT delete the resources.
   * Also removes any synthetic collapsed node and unhides members.
   */
  deleteModule(moduleId: string) {
    this.flushPendingSnapshot();
    this.ensureInitialSnapshot();

    const syntheticId = `_mod_${moduleId}`;
    this.modules = this.modules.filter((m) => m.id !== moduleId);
    this.nodes = this.nodes
      .filter((n) => n.id !== syntheticId)
      .map((n) =>
        n.data.moduleId === moduleId
          ? { ...n, hidden: false, data: { ...n.data, moduleId: undefined } }
          : n,
      );

    if (this.selectedModuleId === moduleId) {
      this.selectedModuleId = null;
    }

    this.pushSnapshot();
  }

  /** Rename a module. */
  renameModule(moduleId: string, name: string) {
    this.flushPendingSnapshot();
    this.ensureInitialSnapshot();

    this.modules = this.modules.map((m) =>
      m.id === moduleId ? { ...m, name } : m,
    );

    this.pushSnapshot();
  }

  /** Toggle a module's collapsed state, hiding/showing member nodes and managing synthetic node. */
  toggleModuleCollapsed(moduleId: string) {
    this.flushPendingSnapshot();
    this.ensureInitialSnapshot();

    const mod = this.modules.find((m) => m.id === moduleId);
    if (!mod) return;

    const collapsing = !mod.collapsed;
    const syntheticId = `_mod_${moduleId}`;

    this.modules = this.modules.map((m) =>
      m.id === moduleId ? { ...m, collapsed: collapsing } : m,
    );

    if (collapsing) {
      // Hide member nodes
      const memberNodes = this.nodes.filter((n) => n.data.moduleId === moduleId);
      const memberCount = memberNodes.length;

      // Compute bounding box center for synthetic node position
      let cx = mod.position.x;
      let cy = mod.position.y;
      if (memberNodes.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const n of memberNodes) {
          if (n.position.x < minX) minX = n.position.x;
          if (n.position.y < minY) minY = n.position.y;
          const w = (n.width as number | undefined) ?? 250;
          const h = (n.height as number | undefined) ?? 100;
          if (n.position.x + w > maxX) maxX = n.position.x + w;
          if (n.position.y + h > maxY) maxY = n.position.y + h;
        }
        cx = (minX + maxX) / 2 - 80;
        cy = (minY + maxY) / 2 - 30;
      }

      // Hide members and add synthetic node
      const syntheticNode = {
        id: syntheticId,
        type: '_terrastudio/module',
        position: { x: cx, y: cy },
        data: {
          moduleId,
          memberCount,
          label: mod.name,
          typeId: '_terrastudio/module' as ResourceTypeId,
          properties: {},
          references: {},
          terraformName: '',
          validationErrors: [],
        },
      } as unknown as DiagramNode;

      this.nodes = [
        ...this.nodes.map((n) =>
          n.data.moduleId === moduleId ? { ...n, hidden: true } : n,
        ),
        syntheticNode,
      ];
    } else {
      // Show member nodes and remove synthetic node
      this.nodes = this.nodes
        .filter((n) => n.id !== syntheticId)
        .map((n) =>
          n.data.moduleId === moduleId ? { ...n, hidden: false } : n,
        );
    }

    this.pushSnapshot();
  }

  /** Update a module's properties (description, color, position). */
  updateModule(moduleId: string, updates: Partial<Pick<ModuleDefinition, 'description' | 'color' | 'position'>>) {
    this.flushPendingSnapshot();
    this.ensureInitialSnapshot();

    this.modules = this.modules.map((m) =>
      m.id === moduleId ? { ...m, ...updates } : m,
    );

    this.pushSnapshot();
  }

  /** Assign nodes to a module. */
  addNodesToModule(moduleId: string, nodeIds: string[]) {
    this.flushPendingSnapshot();
    this.ensureInitialSnapshot();

    this.nodes = this.nodes.map((n) =>
      nodeIds.includes(n.id) ? { ...n, data: { ...n.data, moduleId } } : n,
    );

    this.pushSnapshot();
  }

  /** Remove nodes from their module (clears moduleId). */
  removeNodesFromModule(nodeIds: string[]) {
    this.flushPendingSnapshot();
    this.ensureInitialSnapshot();

    this.nodes = this.nodes.map((n) =>
      nodeIds.includes(n.id)
        ? { ...n, data: { ...n.data, moduleId: undefined } }
        : n,
    );

    this.pushSnapshot();
  }

  /**
   * Duplicate a module: deep-copies all member nodes + internal edges with new IDs.
   * Returns the new module ID and a mapping from old node IDs to new ones.
   */
  duplicateModule(moduleId: string): { newModuleId: string; nodeIdMap: Map<string, string> } {
    this.flushPendingSnapshot();
    this.ensureInitialSnapshot();

    const sourceMod = this.modules.find((m) => m.id === moduleId);
    if (!sourceMod) throw new Error(`Module "${moduleId}" not found`);

    const newModuleId = `mod-${crypto.randomUUID().slice(0, 8)}`;
    const memberNodes = this.nodes.filter((n) => n.data.moduleId === moduleId);
    const memberNodeIds = new Set(memberNodes.map((n) => n.id));

    // Build old→new ID map
    const nodeIdMap = new Map<string, string>();
    for (const node of memberNodes) {
      nodeIdMap.set(node.id, generateNodeId(node.type as ResourceTypeId));
    }

    // Clone nodes
    const OFFSET = 50;
    const existingNames = new Set(this.nodes.map((n) => n.data.terraformName));
    const newNodes: DiagramNode[] = [];

    for (const node of memberNodes) {
      const newId = nodeIdMap.get(node.id)!;
      const newName = generateUniqueTerraformName(
        node.data.label + ' copy',
        existingNames,
      );
      existingNames.add(newName);

      const newNode: DiagramNode = {
        ...structuredClone($state.snapshot(node) as unknown) as DiagramNode,
        id: newId,
        position: {
          x: node.position.x + OFFSET,
          y: node.position.y + OFFSET,
        },
        selected: false,
        data: {
          ...node.data,
          moduleId: newModuleId,
          terraformName: newName,
          label: generateCopyLabel(node.data.label),
          validationErrors: [],
          deploymentStatus: undefined,
        },
      };

      // Remap parentId if parent is also in the module
      if (newNode.parentId && nodeIdMap.has(newNode.parentId as string)) {
        newNode.parentId = nodeIdMap.get(newNode.parentId as string);
      } else if (newNode.parentId && !memberNodeIds.has(newNode.parentId as string)) {
        // Parent is outside module — keep the same parentId
      }

      // Remap references that point to module-internal nodes
      const refs = { ...(newNode.data.references ?? {}) };
      for (const [key, targetId] of Object.entries(refs)) {
        if (nodeIdMap.has(targetId)) {
          refs[key] = nodeIdMap.get(targetId)!;
        }
      }
      newNode.data = { ...newNode.data, references: refs };

      newNodes.push(newNode);
    }

    // Clone internal edges (both endpoints in the module)
    const internalEdges = this.edges.filter(
      (e) => memberNodeIds.has(e.source) && memberNodeIds.has(e.target),
    );
    const newEdges: DiagramEdge[] = internalEdges.map((e) => {
      const newSource = nodeIdMap.get(e.source)!;
      const newTarget = nodeIdMap.get(e.target)!;
      return {
        ...structuredClone($state.snapshot(e) as unknown) as DiagramEdge,
        id: `e-${newSource}-${e.sourceHandle ?? 'default'}-${newTarget}`,
        source: newSource,
        target: newTarget,
      };
    });

    // Create new module definition
    const newMod: ModuleDefinition = {
      ...structuredClone($state.snapshot(sourceMod) as unknown) as ModuleDefinition,
      id: newModuleId,
      name: `${sourceMod.name}-copy`,
      position: {
        x: sourceMod.position.x + OFFSET,
        y: sourceMod.position.y + OFFSET,
      },
    };

    this.modules = [...this.modules, newMod];
    this.nodes = [...this.nodes, ...newNodes];
    this.edges = [...this.edges, ...newEdges];

    this.pushSnapshot();
    return { newModuleId, nodeIdMap };
  }

  // ── Module derived helpers ──────────────────────────────────────

  /** Get all nodes belonging to a module. */
  getModuleNodes(moduleId: string): DiagramNode[] {
    return this.nodes.filter((n) => n.data.moduleId === moduleId);
  }

  /** Get edges where both endpoints are in the same module. */
  getModuleEdges(moduleId: string): DiagramEdge[] {
    const memberIds = new Set(this.getModuleNodes(moduleId).map((n) => n.id));
    return this.edges.filter((e) => memberIds.has(e.source) && memberIds.has(e.target));
  }

  /** Get edges where one endpoint is inside the module and the other is outside. */
  getCrossModuleEdges(moduleId: string): DiagramEdge[] {
    const memberIds = new Set(this.getModuleNodes(moduleId).map((n) => n.id));
    return this.edges.filter(
      (e) => (memberIds.has(e.source)) !== (memberIds.has(e.target)),
    );
  }

  // ── MCP bypass methods ────────────────────────────────────────────
  // These mutate state WITHOUT pushing undo history.
  // Used by the MCP bridge listener so AI-driven mutations are not undoable.

  addNodeSkipHistory(node: DiagramNode) {
    this.nodes = [...this.nodes, node];
    project.markDirty();
    terraform.markFilesStale();
  }

  removeNodeSkipHistory(id: string) {
    // Collect node + all descendants (same cascade logic as removeNode)
    const toRemove = new Set<string>([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const n of this.nodes) {
        if (!toRemove.has(n.id) && n.parentId && toRemove.has(n.parentId as string)) {
          toRemove.add(n.id);
          changed = true;
        }
      }
    }

    this.nodes = this.nodes.filter((n) => !toRemove.has(n.id));
    this.edges = this.edges.filter((e) => !toRemove.has(e.source) && !toRemove.has(e.target));
    for (const removedId of toRemove) {
      this.cleanStaleReferences(removedId);
    }
    if (this.selectedNodeId && toRemove.has(this.selectedNodeId)) {
      this.selectedNodeId = null;
    }
    project.markDirty();
    terraform.markFilesStale();
  }

  updateNodeDataSkipHistory(id: string, data: Partial<ResourceNodeData>) {
    this.nodes = this.nodes.map((n) =>
      n.id === id ? { ...n, data: { ...n.data, ...data } } : n
    );
    project.markDirty();
    terraform.markFilesStale();
  }

  addEdgeSkipHistory(edge: DiagramEdge) {
    this.edges = [...this.edges, edge];
    project.markDirty();
    terraform.markFilesStale();
  }

  removeEdgeSkipHistory(id: string) {
    this.edges = this.edges.filter((e) => e.id !== id);
    project.markDirty();
    terraform.markFilesStale();
  }

  moveNodeSkipHistory(id: string, position: { x: number; y: number }) {
    this.nodes = this.nodes.map((n) =>
      n.id === id ? { ...n, position } : n
    );
    project.markDirty();
  }

  resizeNodeSkipHistory(id: string, width: number, height: number) {
    this.nodes = this.nodes.map((n) =>
      n.id === id ? { ...n, width, height } : n
    );
    project.markDirty();
  }

  reparentNodeSkipHistory(id: string, position: { x: number; y: number }, parentId: string | null) {
    this.nodes = this.nodes.map((n) => {
      if (n.id !== id) return n;
      if (parentId) {
        return { ...n, position, parentId, extent: 'parent' as const };
      }
      // Unparent: remove parentId and extent
      const { parentId: _pid, extent: _ext, ...rest } = n;
      return { ...rest, position };
    });
    project.markDirty();
  }

  // ── MCP bypass: module operations ──────────────────────────────────

  createModuleSkipHistory(name: string, nodeIds: string[]): string {
    const id = `mod-${crypto.randomUUID().slice(0, 8)}`;
    const memberNodes = this.nodes.filter((n) => nodeIds.includes(n.id));
    const minX = memberNodes.length ? Math.min(...memberNodes.map((n) => n.position.x)) : 0;
    const minY = memberNodes.length ? Math.min(...memberNodes.map((n) => n.position.y)) : 0;

    this.modules = [...this.modules, {
      id,
      name,
      collapsed: false,
      position: { x: minX - 20, y: minY - 40 },
    }];
    this.nodes = this.nodes.map((n) =>
      nodeIds.includes(n.id) ? { ...n, data: { ...n.data, moduleId: id } } : n,
    );
    project.markDirty();
    terraform.markFilesStale();
    return id;
  }

  deleteModuleSkipHistory(moduleId: string) {
    this.modules = this.modules.filter((m) => m.id !== moduleId);
    this.nodes = this.nodes.map((n) =>
      n.data.moduleId === moduleId
        ? { ...n, data: { ...n.data, moduleId: undefined } }
        : n,
    );
    if (this.selectedModuleId === moduleId) this.selectedModuleId = null;
    project.markDirty();
    terraform.markFilesStale();
  }

  renameModuleSkipHistory(moduleId: string, name: string) {
    this.modules = this.modules.map((m) =>
      m.id === moduleId ? { ...m, name } : m,
    );
    project.markDirty();
  }

  toggleModuleCollapsedSkipHistory(moduleId: string): boolean {
    let newCollapsed = false;
    this.modules = this.modules.map((m) => {
      if (m.id !== moduleId) return m;
      newCollapsed = !m.collapsed;
      return { ...m, collapsed: newCollapsed };
    });
    project.markDirty();
    return newCollapsed;
  }

  addNodesToModuleSkipHistory(moduleId: string, nodeIds: string[]) {
    this.nodes = this.nodes.map((n) =>
      nodeIds.includes(n.id) ? { ...n, data: { ...n.data, moduleId } } : n,
    );
    project.markDirty();
    terraform.markFilesStale();
  }

  removeNodesFromModuleSkipHistory(nodeIds: string[]) {
    this.nodes = this.nodes.map((n) =>
      nodeIds.includes(n.id)
        ? { ...n, data: { ...n.data, moduleId: undefined } }
        : n,
    );
    project.markDirty();
    terraform.markFilesStale();
  }

  clear() {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.nodes = [];
    this.edges = [];
    this.modules = [];
    this.selectedNodeId = null;
    this.selectedEdgeId = null;
    this.selectedModuleId = null;
    this.history = [];
    this.historyIndex = -1;
  }
}

export const diagram = new DiagramStore();
