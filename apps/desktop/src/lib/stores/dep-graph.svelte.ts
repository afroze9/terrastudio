import type { Node, Edge } from '@xyflow/svelte';
import type { DepGraphData, DepGraphEdge } from '@terrastudio/types';
import { diagram } from './diagram.svelte';
import { ui } from './ui.svelte';
import { registry } from '$lib/bootstrap';
import { buildDependencyGraph } from '@terrastudio/core';
import { layoutDepGraph, type DepGraphNodeData, type DepGraphDirection } from '$lib/services/dep-graph-layout';

const DEBOUNCE_MS = 300;

class DependencyGraphStore {
  data = $state<DepGraphData | null>(null);
  computing = $state(false);
  flowNodes = $state<Node<DepGraphNodeData>[]>([]);
  flowEdges = $state<Edge[]>([]);
  focusedNodeId = $state<string | null>(null);
  direction = $state<DepGraphDirection>('TB');
  private needsRefresh = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  upstreamIds = $derived.by((): Set<string> => {
    if (!this.focusedNodeId || !this.data) return new Set();
    return collectTransitive(this.focusedNodeId, this.data.edges, 'upstream');
  });

  downstreamIds = $derived.by((): Set<string> => {
    if (!this.focusedNodeId || !this.data) return new Set();
    return collectTransitive(this.focusedNodeId, this.data.edges, 'downstream');
  });

  scheduleRefresh(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.refresh(), DEBOUNCE_MS);
  }

  /** Called when the dep-graph tab becomes active */
  onTabActive(): void {
    if (this.needsRefresh) {
      this.needsRefresh = false;
      this.refresh();
    }
  }

  private refresh(): void {
    // If dep-graph tab is not active, defer
    if (ui.activeTabId !== 'dep-graph') {
      this.needsRefresh = true;
      return;
    }

    this.computing = true;
    try {
      const data = buildDependencyGraph(
        diagram.nodes as any[],
        diagram.edges as any[],
        diagram.modules as any[],
        registry.inner,
      );
      this.data = data;
      const layout = layoutDepGraph(data, this.direction);
      this.flowNodes = layout.nodes;
      this.flowEdges = layout.edges;
    } finally {
      this.computing = false;
    }
  }

  setFocus(instanceId: string | null): void {
    this.focusedNodeId = instanceId === this.focusedNodeId ? null : instanceId;
  }

  setDirection(dir: DepGraphDirection): void {
    this.direction = dir;
    this.refresh();
  }

  navigateToCanvas(instanceId: string): void {
    diagram.selectedNodeId = instanceId;
    ui.activeTabId = 'canvas';
  }
}

function collectTransitive(
  startId: string,
  edges: DepGraphEdge[],
  direction: 'upstream' | 'downstream',
): Set<string> {
  const result = new Set<string>();
  const queue = [startId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const e of edges) {
      if (direction === 'upstream' && e.targetInstanceId === current) {
        if (!result.has(e.sourceInstanceId)) {
          result.add(e.sourceInstanceId);
          queue.push(e.sourceInstanceId);
        }
      } else if (direction === 'downstream' && e.sourceInstanceId === current) {
        if (!result.has(e.targetInstanceId)) {
          result.add(e.targetInstanceId);
          queue.push(e.targetInstanceId);
        }
      }
    }
  }

  return result;
}

export const depGraph = new DependencyGraphStore();
