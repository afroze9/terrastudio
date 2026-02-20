import type { Node, Edge } from '@xyflow/svelte';
import type { ResourceNodeData, ResourceTypeId } from '@terrastudio/types';
import { project } from './project.svelte';
import { registry } from '$lib/bootstrap';

export type DiagramNode = Node<ResourceNodeData>;
export type DiagramEdge = Edge;

interface DiagramSnapshot {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

const MAX_HISTORY = 50;

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
    this.nodes = this.nodes.filter((n) => n.id !== id);
    this.edges = this.edges.filter((e) => e.source !== id && e.target !== id);
    this.cleanStaleReferences(id);
    if (this.selectedNodeId === id) {
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
    const selectedIds = new Set(this.nodes.filter((n) => n.selected).map((n) => n.id));
    if (selectedIds.size === 0) return;
    this.flushPendingSnapshot();
    this.ensureInitialSnapshot();
    this.nodes = this.nodes.filter((n) => !selectedIds.has(n.id));
    this.edges = this.edges.filter((e) => !selectedIds.has(e.source) && !selectedIds.has(e.target));
    for (const deletedId of selectedIds) {
      this.cleanStaleReferences(deletedId);
    }
    this.selectedNodeId = null;
    this.pushSnapshot();
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
