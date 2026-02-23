import type { Node, Edge } from '@xyflow/svelte';
import type { ResourceNodeData, ResourceTypeId } from '@terrastudio/types';
import { generateNodeId, generateUniqueTerraformName } from '@terrastudio/core';
import { project } from './project.svelte';
import { terraform } from './terraform.svelte';
import { registry } from '$lib/bootstrap';
import { ui } from './ui.svelte';

export type DiagramNode = Node<ResourceNodeData>;
export type DiagramEdge = Edge;

interface DiagramSnapshot {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
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

  selectedNodeId = $state<string | null>(null);
  selectedEdgeId = $state<string | null>(null);

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
      ? this.edges.find((e) => e.id === this.selectedEdgeId) ?? null
      : null
  );

  private takeSnapshot(): DiagramSnapshot {
    const nodesSnap = $state.snapshot(this.nodes) as unknown;
    const edgesSnap = $state.snapshot(this.edges) as unknown;
    return {
      nodes: structuredClone(nodesSnap) as DiagramNode[],
      edges: structuredClone(edgesSnap) as DiagramEdge[],
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
    this.nodes = structuredClone(nodesSnap) as DiagramNode[];
    this.edges = structuredClone(edgesSnap) as DiagramEdge[];
    this.selectedNodeId = null;
    this.selectedEdgeId = null;
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
    this.ensureInitialSnapshot();

    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }

    project.markDirty();

    this.edges = this.edges.map((e) =>
      e.id === edgeId ? { ...e, label } : e
    );

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

  /** Load a saved diagram without marking dirty or pushing per-node history. */
  loadDiagram(nodes: DiagramNode[], edges: DiagramEdge[]) {
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
    this.selectedNodeId = null;
    this.skipHistory = false;
    // Set initial history snapshot
    this.history = [this.takeSnapshot()];
    this.historyIndex = 0;
  }

  clear() {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.nodes = [];
    this.edges = [];
    this.selectedNodeId = null;
    this.history = [];
    this.historyIndex = -1;
  }
}

export const diagram = new DiagramStore();
