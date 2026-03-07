import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/svelte';
import { MarkerType } from '@xyflow/svelte';
import type { DepGraphData, ResourceTypeId } from '@terrastudio/types';

export interface DepGraphNodeData {
  instanceId: string;
  typeId: ResourceTypeId;
  label: string;
  terraformAddress: string;
  displayName: string;
  category: string;
  deploymentStatus?: string;
  level: number;
  highlight: 'none' | 'focused' | 'upstream' | 'downstream' | 'unrelated';
  [key: string]: unknown;
}

export interface DepGraphLayout {
  nodes: Node<DepGraphNodeData>[];
  edges: Edge[];
}

/** Category color map for the left accent bar on dep graph nodes */
export const CATEGORY_COLORS: Record<string, string> = {
  networking: '#3b82f6',
  compute: '#8b5cf6',
  storage: '#f59e0b',
  database: '#ef4444',
  security: '#10b981',
  core: '#6b7280',
  identity: '#ec4899',
  monitoring: '#06b6d4',
  messaging: '#a855f7',
  serverless: '#f97316',
  containers: '#14b8a6',
  dns: '#6366f1',
};

const NODE_WIDTH = 220;
const NODE_HEIGHT = 64;

export function layoutDepGraph(data: DepGraphData): DepGraphLayout {
  if (data.nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: 'TB',
    nodesep: 48,
    ranksep: 72,
    marginx: 24,
    marginy: 24,
  });
  g.setDefaultNodeLabel(() => ({}));
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of data.nodes) {
    g.setNode(node.instanceId, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  for (const edge of data.edges) {
    g.setEdge(edge.sourceInstanceId, edge.targetInstanceId);
  }

  dagre.layout(g);

  const flowNodes: Node<DepGraphNodeData>[] = data.nodes.map((n) => {
    const pos = g.node(n.instanceId);
    return {
      id: n.instanceId,
      type: 'dep-graph-node',
      position: {
        x: (pos?.x ?? 0) - NODE_WIDTH / 2,
        y: (pos?.y ?? 0) - NODE_HEIGHT / 2,
      },
      data: {
        instanceId: n.instanceId,
        typeId: n.typeId,
        label: n.label,
        terraformAddress: n.terraformAddress,
        displayName: n.displayName,
        category: n.category,
        deploymentStatus: n.deploymentStatus,
        level: n.level,
        highlight: 'none' as const,
      },
      draggable: false,
      connectable: false,
      deletable: false,
    };
  });

  const edgeColors: Record<string, string> = {
    explicit: 'var(--color-accent)',
    reference: '#6b7280',
    binding: '#f59e0b',
  };

  const flowEdges: Edge[] = data.edges.map((e, i) => ({
    id: `dep-${i}`,
    source: e.sourceInstanceId,
    target: e.targetInstanceId,
    type: 'straight',
    markerEnd: { type: MarkerType.ArrowClosed },
    style: `stroke: ${edgeColors[e.kind] ?? '#6b7280'}; stroke-width: 1.5;`,
    animated: false,
    deletable: false,
    selectable: false,
  }));

  return { nodes: flowNodes, edges: flowEdges };
}
