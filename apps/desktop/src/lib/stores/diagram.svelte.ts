import type { Node, Edge } from '@xyflow/svelte';
import type { ResourceNodeData } from '@terrastudio/types';
import { project } from './project.svelte';

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

  // Undo/redo history — each entry is a complete state snapshot.
  // historyIndex points to the entry representing the current state.
  private history = $state<DiagramSnapshot[]>([]);
  private historyIndex = $state(-1);
  private skipHistory = false;

  canUndo = $derived(this.historyIndex > 0);
  canRedo = $derived(this.historyIndex < this.history.length - 1);

  selectedNode = $derived(
    this.selectedNodeId
      ? this.nodes.find((n) => n.id === this.selectedNodeId) ?? null
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

  /** Save current state to history (call after external mutations like drag stop). */
  saveSnapshot() {
    this.ensureInitialSnapshot();
    this.pushSnapshot();
  }

  undo() {
    if (!this.canUndo) return;
    this.historyIndex--;
    this.restoreSnapshot(this.history[this.historyIndex]);
    project.markDirty();
  }

  redo() {
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
    this.skipHistory = false;
  }

  addNode(node: DiagramNode) {
    this.ensureInitialSnapshot();
    this.nodes = [...this.nodes, node];
    this.pushSnapshot();
  }

  removeNode(id: string) {
    this.ensureInitialSnapshot();
    this.nodes = this.nodes.filter((n) => n.id !== id);
    this.edges = this.edges.filter((e) => e.source !== id && e.target !== id);
    if (this.selectedNodeId === id) {
      this.selectedNodeId = null;
    }
    this.pushSnapshot();
  }

  updateNodeData(id: string, data: Partial<ResourceNodeData>) {
    this.ensureInitialSnapshot();
    this.nodes = this.nodes.map((n) =>
      n.id === id ? { ...n, data: { ...n.data, ...data } } : n
    );
    this.pushSnapshot();
  }

  addEdge(edge: DiagramEdge) {
    this.ensureInitialSnapshot();
    this.edges = [...this.edges, edge];
    this.pushSnapshot();
  }

  removeSelectedNodes() {
    const selectedIds = new Set(this.nodes.filter((n) => n.selected).map((n) => n.id));
    if (selectedIds.size === 0) return;
    this.ensureInitialSnapshot();
    this.nodes = this.nodes.filter((n) => !selectedIds.has(n.id));
    this.edges = this.edges.filter((e) => !selectedIds.has(e.source) && !selectedIds.has(e.target));
    this.selectedNodeId = null;
    this.pushSnapshot();
  }

  removeEdge(id: string) {
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
    this.nodes = structuredClone(nodes);
    this.edges = structuredClone(edges);
    this.selectedNodeId = null;
    this.skipHistory = false;
    // Set initial history snapshot
    this.history = [this.takeSnapshot()];
    this.historyIndex = 0;
  }

  clear() {
    this.nodes = [];
    this.edges = [];
    this.selectedNodeId = null;
    this.history = [];
    this.historyIndex = -1;
  }
}

export const diagram = new DiagramStore();
