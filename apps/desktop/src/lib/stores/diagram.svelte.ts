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

  // Undo/redo history
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

  private pushSnapshot() {
    if (this.skipHistory) return;
    project.markDirty();

    // Discard any future history if we're not at the end
    const newHistory = this.history.slice(0, this.historyIndex + 1);

    // Cast through unknown to avoid "excessively deep" type instantiation
    // with Svelte Flow's deeply nested node/edge types
    const nodesSnap = $state.snapshot(this.nodes) as unknown;
    const edgesSnap = $state.snapshot(this.edges) as unknown;
    newHistory.push({
      nodes: structuredClone(nodesSnap) as DiagramNode[],
      edges: structuredClone(edgesSnap) as DiagramEdge[],
    });

    // Cap history size
    if (newHistory.length > MAX_HISTORY) {
      newHistory.shift();
    }

    this.history = newHistory;
    this.historyIndex = newHistory.length - 1;
  }

  /** Save current state as a snapshot (call before external mutations like drag). */
  saveSnapshot() {
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
    this.pushSnapshot();
    this.nodes = [...this.nodes, node];
  }

  removeNode(id: string) {
    this.pushSnapshot();
    this.nodes = this.nodes.filter((n) => n.id !== id);
    this.edges = this.edges.filter((e) => e.source !== id && e.target !== id);
    if (this.selectedNodeId === id) {
      this.selectedNodeId = null;
    }
  }

  updateNodeData(id: string, data: Partial<ResourceNodeData>) {
    this.pushSnapshot();
    this.nodes = this.nodes.map((n) =>
      n.id === id ? { ...n, data: { ...n.data, ...data } } : n
    );
  }

  addEdge(edge: DiagramEdge) {
    this.pushSnapshot();
    this.edges = [...this.edges, edge];
  }

  removeSelectedNodes() {
    const selectedIds = new Set(this.nodes.filter((n) => n.selected).map((n) => n.id));
    if (selectedIds.size === 0) return;
    this.pushSnapshot();
    this.nodes = this.nodes.filter((n) => !selectedIds.has(n.id));
    this.edges = this.edges.filter((e) => !selectedIds.has(e.source) && !selectedIds.has(e.target));
    this.selectedNodeId = null;
  }

  removeEdge(id: string) {
    this.pushSnapshot();
    this.edges = this.edges.filter((e) => e.id !== id);
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
    const nodesSnap = $state.snapshot(this.nodes) as unknown;
    const edgesSnap = $state.snapshot(this.edges) as unknown;
    this.history = [{
      nodes: structuredClone(nodesSnap) as DiagramNode[],
      edges: structuredClone(edgesSnap) as DiagramEdge[],
    }];
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
