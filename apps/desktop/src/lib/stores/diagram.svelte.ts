import type { Node, Edge } from '@xyflow/svelte';
import type { ResourceNodeData, ResourceTypeId, ValidationError, TerraStudioEdgeData, EdgeCategoryId, ReferenceEdgeOverrides, HandleDefinition, ModuleDefinition, ModuleInstance } from '@terrastudio/types';
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
  moduleInstances: ModuleInstance[];
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
  moduleInstances = $state<ModuleInstance[]>([]);

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
    const instancesSnap = $state.snapshot(this.moduleInstances) as unknown;
    return {
      nodes: structuredClone(nodesSnap) as DiagramNode[],
      edges: structuredClone(edgesSnap) as DiagramEdge[],
      modules: structuredClone(modulesSnap) as ModuleDefinition[],
      moduleInstances: structuredClone(instancesSnap) as ModuleInstance[],
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
    const instancesSnap = $state.snapshot(snapshot.moduleInstances ?? []) as unknown;
    this.nodes = structuredClone(nodesSnap) as DiagramNode[];
    this.edges = structuredClone(edgesSnap) as DiagramEdge[];
    this.modules = structuredClone(modulesSnap) as ModuleDefinition[];
    this.moduleInstances = structuredClone(instancesSnap) as ModuleInstance[];
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
  loadDiagram(nodes: DiagramNode[], edges: DiagramEdge[], modules?: ModuleDefinition[], moduleInstances?: ModuleInstance[]) {
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
    // Reset all instances to collapsed on load — transient _instmem_ clones aren't persisted
    this.moduleInstances = structuredClone(moduleInstances ?? []).map(
      (inst) => ({ ...inst, collapsed: true }),
    );

    // Ensure synthetic nodes exist for all module instances.
    // Parent them to the same container as the template's root members.
    for (const inst of this.moduleInstances) {
      const syntheticId = `_modinst_${inst.id}`;
      if (!this.nodes.some((n) => n.id === syntheticId)) {
        const externalParent = this.getTemplateExternalParent(inst.templateId);
        let synPos = inst.position;
        if (externalParent) {
          let px = 0, py = 0;
          let cur: DiagramNode | undefined = this.nodes.find((n) => n.id === externalParent);
          while (cur) {
            px += cur.position.x;
            py += cur.position.y;
            cur = cur.parentId ? this.nodes.find((n) => n.id === (cur!.parentId as string)) : undefined;
          }
          synPos = { x: inst.position.x - px, y: inst.position.y - py };
        }
        this.nodes.push({
          id: syntheticId,
          type: '_terrastudio/module_instance',
          position: synPos,
          zIndex: 1000,
          ...(externalParent ? { parentId: externalParent } : {}),
          data: {
            instanceId: inst.id,
            label: inst.name,
            typeId: '_terrastudio/module_instance' as any,
            properties: {},
            references: {},
            terraformName: '',
            validationErrors: [],
          },
        } as unknown as DiagramNode);
      }
    }

    // Hide member nodes of template modules (templates are only visible via instances)
    const templateModuleIds = new Set(
      this.modules.filter((m) => m.isTemplate).map((m) => m.id),
    );
    if (templateModuleIds.size > 0) {
      this.nodes = this.nodes.map((n) =>
        templateModuleIds.has(n.data.moduleId as string) ? { ...n, hidden: true } : n,
      );
    }

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
   * If the module is a template, cascade-deletes all its instances and their edges.
   */
  deleteModule(moduleId: string) {
    this.flushPendingSnapshot();
    this.ensureInitialSnapshot();

    const mod = this.modules.find((m) => m.id === moduleId);
    const syntheticId = `_mod_${moduleId}`;
    this.modules = this.modules.filter((m) => m.id !== moduleId);
    this.nodes = this.nodes
      .filter((n) => n.id !== syntheticId)
      .map((n) =>
        n.data.moduleId === moduleId
          ? { ...n, hidden: false, data: { ...n.data, moduleId: undefined } }
          : n,
      );

    // Cascade-delete instances if this was a template
    if (mod?.isTemplate) {
      const instanceIds = new Set(
        this.moduleInstances.filter((i) => i.templateId === moduleId).map((i) => i.id),
      );
      this.moduleInstances = this.moduleInstances.filter((i) => i.templateId !== moduleId);
      // Remove synthetic instance nodes, cloned member nodes, and their edges
      const syntheticInstanceIds = new Set([...instanceIds].map((id) => `_modinst_${id}`));
      const clonePrefixes = [...instanceIds].map((id) => `_instmem_${id}_`);
      this.nodes = this.nodes.filter((n) =>
        !syntheticInstanceIds.has(n.id) && !clonePrefixes.some((p) => n.id.startsWith(p)),
      );
      this.edges = this.edges.filter(
        (e) => !syntheticInstanceIds.has(e.source) && !syntheticInstanceIds.has(e.target)
          && !clonePrefixes.some((p) => e.id.startsWith(p)),
      );
    }

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
        zIndex: 1000,
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
      let updatedNodes = this.nodes
        .filter((n) => n.id !== syntheticId)
        .map((n) =>
          n.data.moduleId === moduleId ? { ...n, hidden: false } : n,
        );

      // Push non-member nodes out of the way if they overlap the expanding module area
      const memberNodes = updatedNodes.filter((n) => n.data.moduleId === moduleId);
      if (memberNodes.length > 0) {
        const PUSH_GAP = 40;

        // Compute absolute position by walking up the parent chain
        const getAbsPos = (node: DiagramNode): { x: number; y: number } => {
          let x = node.position.x;
          let y = node.position.y;
          let pid = node.parentId as string | undefined;
          while (pid) {
            const parent = updatedNodes.find((n) => n.id === pid);
            if (!parent) break;
            x += parent.position.x;
            y += parent.position.y;
            pid = parent.parentId as string | undefined;
          }
          return { x, y };
        };

        // Compute absolute bounding box of all member nodes
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const n of memberNodes) {
          const abs = getAbsPos(n);
          const w = n.measured?.width ?? (n.width as number | undefined) ?? 250;
          const h = n.measured?.height ?? (n.height as number | undefined) ?? 100;
          if (abs.x < minX) minX = abs.x;
          if (abs.y < minY) minY = abs.y;
          if (abs.x + w > maxX) maxX = abs.x + w;
          if (abs.y + h > maxY) maxY = abs.y + h;
        }

        // Build set of member IDs and their ancestor container IDs (those shouldn't move)
        const memberIds = new Set(memberNodes.map((n) => n.id));
        const memberAncestorIds = new Set<string>();
        for (const n of memberNodes) {
          let pid = n.parentId as string | undefined;
          while (pid) {
            memberAncestorIds.add(pid);
            pid = updatedNodes.find((p) => p.id === pid)?.parentId as string | undefined;
          }
        }

        // Collect IDs of nodes that need pushing (and their descendants)
        const pushNodeIds = new Set<string>();
        for (const n of updatedNodes) {
          if (memberIds.has(n.id)) continue;
          if (memberAncestorIds.has(n.id)) continue;
          if (n.hidden) continue;

          const abs = getAbsPos(n);
          const w = n.measured?.width ?? (n.width as number | undefined) ?? 250;
          const h = n.measured?.height ?? (n.height as number | undefined) ?? 100;

          const overlapsX = abs.x < maxX + PUSH_GAP && abs.x + w > minX;
          const overlapsY = abs.y < maxY + PUSH_GAP && abs.y + h > minY;

          if (overlapsX && overlapsY) {
            pushNodeIds.add(n.id);
          }
        }

        if (pushNodeIds.size > 0) {
          // Find the highest-level ancestors among pushNodeIds so we move
          // whole subtrees rather than individual children
          const rootPushIds = new Set<string>();
          for (const id of pushNodeIds) {
            const node = updatedNodes.find((n) => n.id === id)!;
            // Walk up: if any ancestor is also in pushNodeIds, skip this one
            let pid = node.parentId as string | undefined;
            let ancestorPushed = false;
            while (pid) {
              if (pushNodeIds.has(pid)) { ancestorPushed = true; break; }
              pid = updatedNodes.find((n) => n.id === pid)?.parentId as string | undefined;
            }
            if (!ancestorPushed) rootPushIds.add(id);
          }

          // Compute how far right to push: from their current x to past the module box
          updatedNodes = updatedNodes.map((n) => {
            if (!rootPushIds.has(n.id)) return n;
            const abs = getAbsPos(n);
            const delta = (maxX + PUSH_GAP) - abs.x;
            if (delta <= 0) return n;
            return { ...n, position: { ...n.position, x: n.position.x + delta } };
          });
        }
      }

      this.nodes = updatedNodes;
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

  // ── Module template/instance CRUD ────────────────────────────────

  /**
   * Convert an existing module to a reusable template.
   * Template member nodes are hidden from the canvas (like a collapsed module).
   * Instances are created by dragging from the palette.
   */
  convertToTemplate(moduleId: string) {
    this.flushPendingSnapshot();
    this.ensureInitialSnapshot();
    this.modules = this.modules.map((m) =>
      m.id === moduleId ? { ...m, isTemplate: true } : m,
    );
    // Hide template member nodes from canvas
    this.nodes = this.nodes.map((n) =>
      n.data.moduleId === moduleId ? { ...n, hidden: true } : n,
    );
    this.pushSnapshot();
  }

  /** Convert a template back to a regular module. Cascade-deletes all instances. */
  unconvertTemplate(moduleId: string) {
    this.flushPendingSnapshot();
    this.ensureInitialSnapshot();
    this.modules = this.modules.map((m) =>
      m.id === moduleId ? { ...m, isTemplate: false } : m,
    );
    // Remove all instances of this template
    const instanceIds = new Set(
      this.moduleInstances.filter((i) => i.templateId === moduleId).map((i) => i.id),
    );
    this.moduleInstances = this.moduleInstances.filter((i) => i.templateId !== moduleId);
    // Remove synthetic instance nodes and their edges
    const syntheticIds = new Set([...instanceIds].map((id) => `_modinst_${id}`));
    this.nodes = this.nodes
      .filter((n) => !syntheticIds.has(n.id))
      // Unhide template member nodes
      .map((n) => n.data.moduleId === moduleId ? { ...n, hidden: false } : n);
    this.edges = this.edges.filter(
      (e) => !syntheticIds.has(e.source) && !syntheticIds.has(e.target),
    );
    this.pushSnapshot();
  }

  /**
   * Create a new instance of a module template.
   * Optionally accepts a canvas position (used when dragging from palette).
   * Returns the new instance ID.
   */
  createModuleInstance(templateId: string, name: string, atPosition?: { x: number; y: number }): string {
    this.flushPendingSnapshot();
    this.ensureInitialSnapshot();

    const template = this.modules.find((m) => m.id === templateId);
    if (!template || !template.isTemplate) {
      throw new Error(`Module "${templateId}" is not a template`);
    }

    // Validate instance name uniqueness across all instances
    const nameExists = this.moduleInstances.some((i) => i.name === name);
    if (nameExists) {
      throw new Error(`Instance name "${name}" is already in use`);
    }

    const id = `modinst-${crypto.randomUUID().slice(0, 8)}`;
    const position = atPosition ?? {
      x: template.position.x + 300,
      y: template.position.y + (this.getTemplateInstances(templateId).length * 120),
    };

    const instance: ModuleInstance = {
      id,
      templateId,
      name,
      position,
      variableValues: {},
      color: template.color,
    };

    this.moduleInstances = [...this.moduleInstances, instance];

    // Insert synthetic node for SvelteFlow rendering.
    // Parent it to the same container as the template's root members so it moves with the hierarchy.
    const externalParent = this.getTemplateExternalParent(templateId);
    let syntheticPosition = position;
    // If the template members are inside a container, convert the absolute position to parent-relative
    if (externalParent) {
      const parentNode = this.nodes.find((n) => n.id === externalParent);
      if (parentNode) {
        // Walk parent chain to get absolute position of the container
        let px = 0, py = 0;
        let cur: DiagramNode | undefined = parentNode;
        while (cur) {
          px += cur.position.x;
          py += cur.position.y;
          cur = cur.parentId ? this.nodes.find((n) => n.id === (cur!.parentId as string)) : undefined;
        }
        syntheticPosition = { x: position.x - px, y: position.y - py };
      }
    }
    const syntheticId = `_modinst_${id}`;
    const syntheticNode = {
      id: syntheticId,
      type: '_terrastudio/module_instance',
      position: syntheticPosition,
      zIndex: 1000,
      ...(externalParent ? { parentId: externalParent } : {}),
      data: {
        instanceId: id,
        label: name,
        typeId: '_terrastudio/module_instance' as any,
        properties: {},
        references: {},
        terraformName: '',
        validationErrors: [],
      },
    } as unknown as DiagramNode;
    this.nodes = [...this.nodes, syntheticNode];

    this.pushSnapshot();
    return id;
  }

  /** Delete a module instance and its edges. */
  deleteModuleInstance(instanceId: string) {
    this.flushPendingSnapshot();
    this.ensureInitialSnapshot();

    const inst = this.moduleInstances.find((i) => i.id === instanceId);
    this.moduleInstances = this.moduleInstances.filter((i) => i.id !== instanceId);

    // Remove synthetic instance node and connected edges
    const syntheticId = `_modinst_${instanceId}`;
    const clonePrefix = `_instmem_${instanceId}_`;
    this.nodes = this.nodes.filter((n) =>
      n.id !== syntheticId && !n.id.startsWith(clonePrefix),
    );
    this.edges = this.edges.filter(
      (e) => e.source !== syntheticId && e.target !== syntheticId && !e.id.startsWith(clonePrefix),
    );

    this.pushSnapshot();
  }

  /** Update a variable value on a module instance. */
  updateInstanceVariable(instanceId: string, varName: string, value: unknown) {
    this.flushPendingSnapshot();
    this.ensureInitialSnapshot();

    this.moduleInstances = this.moduleInstances.map((i) =>
      i.id === instanceId
        ? { ...i, variableValues: { ...i.variableValues, [varName]: value } }
        : i,
    );
    this.pushSnapshot();
  }

  /**
   * Toggle instance collapsed state.
   * Expanding clones the template's member nodes as read-only copies near the instance.
   * Multiple instances of the same template can be expanded simultaneously.
   */
  toggleInstanceCollapsed(instanceId: string) {
    this.flushPendingSnapshot();
    this.ensureInitialSnapshot();

    const inst = this.moduleInstances.find((i) => i.id === instanceId);
    if (!inst) return;

    const expanding = inst.collapsed !== false; // default true → expanding means setting collapsed=false
    const syntheticId = `_modinst_${instanceId}`;

    if (expanding) {
      // Mark this instance as expanded
      this.moduleInstances = this.moduleInstances.map((i) =>
        i.id === instanceId ? { ...i, collapsed: false } : i,
      );

      // Clone template member nodes for this instance (only originals, never other instance clones)
      const templateMembers = this.nodes.filter(
        (n) => n.data.moduleId === inst.templateId && !n.id.startsWith('_instmem_'),
      );
      const templateMemberIds = new Set(templateMembers.map((n) => n.id));
      const syntheticNode = this.nodes.find((n) => n.id === syntheticId);
      const instPos = syntheticNode?.position ?? inst.position;

      // Pass 1: Build complete ID mapping (original → clone) BEFORE creating any clones
      const idMap = new Map<string, string>();
      for (const node of templateMembers) {
        idMap.set(node.id, `_instmem_${instanceId}_${node.id}`);
      }

      // Identify root-level template members (no parent, or parent outside template)
      const rootMembers = templateMembers.filter(
        (n) => !n.parentId || !templateMemberIds.has(n.parentId as string),
      );

      // Compute offset in parent-relative coordinates.
      // Both instPos and root member positions are relative to the same external parent
      // (or both absolute if no parent), so the offset is a simple subtraction.
      let tMinX = Infinity, tMinY = Infinity;
      for (const n of rootMembers) {
        if (n.position.x < tMinX) tMinX = n.position.x;
        if (n.position.y < tMinY) tMinY = n.position.y;
      }
      const offsetX = instPos.x - tMinX;
      const offsetY = instPos.y - tMinY + 10;

      // Pass 2: Create clones with correct parentId and position
      const clonedNodes: DiagramNode[] = [];
      for (const node of templateMembers) {
        const clonedId = idMap.get(node.id)!;
        const snapshot = structuredClone($state.snapshot(node) as any);
        const hasParentInTemplate = node.parentId && templateMemberIds.has(node.parentId as string);
        const hasExternalParent = node.parentId && !templateMemberIds.has(node.parentId as string);

        // Position logic:
        // - Child of another template member: keep relative position (parent clone is already offset)
        // - Has external parent or no parent: apply offset (same coordinate space)
        const position = hasParentInTemplate
          ? { x: node.position.x, y: node.position.y }
          : { x: node.position.x + offsetX, y: node.position.y + offsetY };

        // ParentId: remap if within template, preserve if external, clear if none
        let cloneParentId: string | undefined;
        let extent: string | undefined;
        if (hasParentInTemplate) {
          cloneParentId = idMap.get(node.parentId as string);
          extent = node.extent as string | undefined;
        } else if (hasExternalParent) {
          cloneParentId = node.parentId as string;
          extent = node.extent as string | undefined;
        }

        const clone: any = {
          ...snapshot,
          id: clonedId,
          position,
          hidden: false,
          selected: false,
          draggable: false,
          selectable: true,
          data: {
            ...structuredClone($state.snapshot(node.data) as any),
            moduleId: undefined,
            instanceMemberId: instanceId,
            sourceTemplateNodeId: node.id,
          },
        };

        if (cloneParentId) {
          clone.parentId = cloneParentId;
          if (hasParentInTemplate && extent) {
            clone.extent = extent;
          } else {
            delete clone.extent;
          }
        } else {
          delete clone.parentId;
          delete clone.extent;
        }

        clonedNodes.push(clone as DiagramNode);
      }

      // Clone internal edges between template members
      const clonedEdges: DiagramEdge[] = [];
      for (const edge of this.edges) {
        if (templateMemberIds.has(edge.source) && templateMemberIds.has(edge.target)) {
          clonedEdges.push({
            ...structuredClone($state.snapshot(edge) as any),
            id: `_instmem_${instanceId}_${edge.id}`,
            source: idMap.get(edge.source)!,
            target: idMap.get(edge.target)!,
          });
        }
      }

      // Hide the synthetic instance node, add cloned nodes and edges
      this.nodes = [
        ...this.nodes.map((n) => n.id === syntheticId ? { ...n, hidden: true } : n),
        ...clonedNodes,
      ];
      this.edges = [...this.edges, ...clonedEdges];
    } else {
      this._collapseInstance(instanceId);
    }

    this.pushSnapshot();
  }

  /** Internal: collapse a single instance — remove cloned nodes/edges, show card. */
  private _collapseInstance(instanceId: string) {
    const inst = this.moduleInstances.find((i) => i.id === instanceId);
    if (!inst) return;

    const syntheticId = `_modinst_${instanceId}`;
    const clonePrefix = `_instmem_${instanceId}_`;

    this.moduleInstances = this.moduleInstances.map((i) =>
      i.id === instanceId ? { ...i, collapsed: true } : i,
    );

    // Remove cloned nodes and edges, show synthetic instance node
    this.nodes = this.nodes
      .filter((n) => !n.id.startsWith(clonePrefix))
      .map((n) => n.id === syntheticId ? { ...n, hidden: false } : n);
    this.edges = this.edges.filter((e) => !e.id.startsWith(clonePrefix));
  }

  /** Update module instance properties (name, description, position, color). */
  updateModuleInstance(instanceId: string, updates: Partial<Pick<ModuleInstance, 'name' | 'description' | 'position' | 'color'>>) {
    this.flushPendingSnapshot();
    this.ensureInitialSnapshot();

    this.moduleInstances = this.moduleInstances.map((i) =>
      i.id === instanceId ? { ...i, ...updates } : i,
    );
    this.pushSnapshot();
  }

  // ── Module derived helpers ──────────────────────────────────────

  /** Get all nodes belonging to a module. */
  getModuleNodes(moduleId: string): DiagramNode[] {
    return this.nodes.filter((n) => n.data.moduleId === moduleId);
  }

  /**
   * Find the external parent (e.g., Resource Group) of a template's root members.
   * Returns the parentId if all root members share the same external parent, or undefined.
   */
  getTemplateExternalParent(templateId: string): string | undefined {
    const members = this.nodes.filter((n) => n.data.moduleId === templateId && !n.id.startsWith('_instmem_'));
    const memberIds = new Set(members.map((n) => n.id));
    // Root members: no parent, or parent outside the template
    const rootMembers = members.filter((n) => !n.parentId || !memberIds.has(n.parentId as string));
    if (rootMembers.length === 0) return undefined;
    // Check if they all share the same external parent
    const parents = new Set(rootMembers.map((n) => n.parentId as string | undefined).filter(Boolean));
    return parents.size === 1 ? [...parents][0] : undefined;
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

  /** Get all instances of a template module. */
  getTemplateInstances(templateId: string): ModuleInstance[] {
    return this.moduleInstances.filter((i) => i.templateId === templateId);
  }

  /** Get a module instance by ID. */
  getModuleInstance(instanceId: string): ModuleInstance | undefined {
    return this.moduleInstances.find((i) => i.id === instanceId);
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
    const mod = this.modules.find((m) => m.id === moduleId);
    this.modules = this.modules.filter((m) => m.id !== moduleId);
    this.nodes = this.nodes.map((n) =>
      n.data.moduleId === moduleId
        ? { ...n, data: { ...n.data, moduleId: undefined } }
        : n,
    );
    // Cascade-delete instances if this was a template
    if (mod?.isTemplate) {
      const instanceIds = new Set(
        this.moduleInstances.filter((i) => i.templateId === moduleId).map((i) => i.id),
      );
      this.moduleInstances = this.moduleInstances.filter((i) => i.templateId !== moduleId);
      const syntheticIds = new Set([...instanceIds].map((id) => `_modinst_${id}`));
      const clonePrefixes = [...instanceIds].map((id) => `_instmem_${id}_`);
      this.nodes = this.nodes.filter((n) =>
        !syntheticIds.has(n.id) && !clonePrefixes.some((p) => n.id.startsWith(p)),
      );
      this.edges = this.edges.filter(
        (e) => !syntheticIds.has(e.source) && !syntheticIds.has(e.target)
          && !clonePrefixes.some((p) => e.id.startsWith(p)),
      );
    }
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

  // ── MCP bypass: template/instance operations ────────────────────

  convertToTemplateSkipHistory(moduleId: string) {
    this.modules = this.modules.map((m) =>
      m.id === moduleId ? { ...m, isTemplate: true } : m,
    );
    // Hide template member nodes
    this.nodes = this.nodes.map((n) =>
      n.data.moduleId === moduleId ? { ...n, hidden: true } : n,
    );
    project.markDirty();
    terraform.markFilesStale();
  }

  createModuleInstanceSkipHistory(templateId: string, name: string): string {
    const template = this.modules.find((m) => m.id === templateId);
    if (!template || !template.isTemplate) {
      throw new Error(`Module "${templateId}" is not a template`);
    }
    const id = `modinst-${crypto.randomUUID().slice(0, 8)}`;
    const position = {
      x: template.position.x + 300,
      y: template.position.y + (this.getTemplateInstances(templateId).length * 120),
    };
    this.moduleInstances = [...this.moduleInstances, {
      id,
      templateId,
      name,
      position,
      variableValues: {},
      color: template.color,
    }];
    // Insert synthetic node — parent to same container as template root members
    const externalParent = this.getTemplateExternalParent(templateId);
    let syntheticPosition = position;
    if (externalParent) {
      const parentNode = this.nodes.find((n) => n.id === externalParent);
      if (parentNode) {
        let px = 0, py = 0;
        let cur: DiagramNode | undefined = parentNode;
        while (cur) {
          px += cur.position.x;
          py += cur.position.y;
          cur = cur.parentId ? this.nodes.find((n) => n.id === (cur!.parentId as string)) : undefined;
        }
        syntheticPosition = { x: position.x - px, y: position.y - py };
      }
    }
    const syntheticId = `_modinst_${id}`;
    this.nodes = [...this.nodes, {
      id: syntheticId,
      type: '_terrastudio/module_instance',
      position: syntheticPosition,
      zIndex: 1000,
      ...(externalParent ? { parentId: externalParent } : {}),
      data: {
        instanceId: id,
        label: name,
        typeId: '_terrastudio/module_instance' as any,
        properties: {},
        references: {},
        terraformName: '',
        validationErrors: [],
      },
    } as unknown as DiagramNode];
    project.markDirty();
    terraform.markFilesStale();
    return id;
  }

  deleteModuleInstanceSkipHistory(instanceId: string) {
    this.moduleInstances = this.moduleInstances.filter((i) => i.id !== instanceId);
    const syntheticId = `_modinst_${instanceId}`;
    const clonePrefix = `_instmem_${instanceId}_`;
    this.nodes = this.nodes.filter((n) =>
      n.id !== syntheticId && !n.id.startsWith(clonePrefix),
    );
    this.edges = this.edges.filter(
      (e) => e.source !== syntheticId && e.target !== syntheticId && !e.id.startsWith(clonePrefix),
    );
    project.markDirty();
    terraform.markFilesStale();
  }

  updateInstanceVariableSkipHistory(instanceId: string, varName: string, value: unknown) {
    this.moduleInstances = this.moduleInstances.map((i) =>
      i.id === instanceId
        ? { ...i, variableValues: { ...i.variableValues, [varName]: value } }
        : i,
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
    this.moduleInstances = [];
    this.selectedNodeId = null;
    this.selectedEdgeId = null;
    this.selectedModuleId = null;
    this.history = [];
    this.historyIndex = -1;
  }
}

export const diagram = new DiagramStore();
