import type { Node, Edge } from '@xyflow/svelte';
import type { ResourceNodeData } from '@terrastudio/types';

export type DiagramNode = Node<ResourceNodeData>;
export type DiagramEdge = Edge;

class DiagramStore {
  nodes = $state<DiagramNode[]>([]);
  edges = $state<DiagramEdge[]>([]);

  selectedNodeId = $state<string | null>(null);

  selectedNode = $derived(
    this.selectedNodeId
      ? this.nodes.find((n) => n.id === this.selectedNodeId) ?? null
      : null
  );

  addNode(node: DiagramNode) {
    this.nodes = [...this.nodes, node];
  }

  removeNode(id: string) {
    this.nodes = this.nodes.filter((n) => n.id !== id);
    this.edges = this.edges.filter((e) => e.source !== id && e.target !== id);
    if (this.selectedNodeId === id) {
      this.selectedNodeId = null;
    }
  }

  updateNodeData(id: string, data: Partial<ResourceNodeData>) {
    this.nodes = this.nodes.map((n) =>
      n.id === id ? { ...n, data: { ...n.data, ...data } } : n
    );
  }

  addEdge(edge: DiagramEdge) {
    this.edges = [...this.edges, edge];
  }

  removeEdge(id: string) {
    this.edges = this.edges.filter((e) => e.id !== id);
  }

  clear() {
    this.nodes = [];
    this.edges = [];
    this.selectedNodeId = null;
  }
}

export const diagram = new DiagramStore();
