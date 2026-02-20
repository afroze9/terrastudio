import dagre from '@dagrejs/dagre';
import type { ResourceTypeId } from '@terrastudio/types';
import type { PluginRegistry } from '@terrastudio/core';
import { diagram } from '$lib/stores/diagram.svelte';

const HEADER_HEIGHT = 40; // container header padding
const CONTAINER_PAD_X = 20;
const CONTAINER_PAD_BOTTOM = 20;
const NODE_SEP = 40;
const RANK_SEP = 60;

export type LayoutDirection = 'TB' | 'BT' | 'LR' | 'RL';

/**
 * Auto-layout all diagram nodes using dagre's hierarchical layout.
 * Groups nodes by parent, lays out each group, then sizes containers to fit.
 */
export function autoLayout(registry: PluginRegistry, direction: LayoutDirection = 'TB'): void {
  const nodes = diagram.nodes;
  const edges = diagram.edges;
  if (nodes.length === 0) return;

  // Build lookup for quick access
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Group nodes by parentId (undefined for root-level nodes)
  const groups = new Map<string | undefined, string[]>();
  for (const node of nodes) {
    const parentId = node.parentId as string | undefined;
    const list = groups.get(parentId) ?? [];
    list.push(node.id);
    groups.set(parentId, list);
  }

  // Compute positions bottom-up: lay out leaf groups first, then their parents
  // so we can size parent containers based on children's layout.
  const positions = new Map<string, { x: number; y: number }>();
  const computedSizes = new Map<string, { width: number; height: number }>();

  // Process groups in bottom-up order (deepest children first)
  const processOrder = getBottomUpOrder(groups, nodeMap);

  for (const parentId of processOrder) {
    const childIds = groups.get(parentId) ?? [];
    if (childIds.length === 0) continue;

    // Create dagre graph for this group
    const g = new dagre.graphlib.Graph();
    g.setGraph({
      rankdir: direction,
      nodesep: NODE_SEP,
      ranksep: RANK_SEP,
      marginx: CONTAINER_PAD_X,
      marginy: CONTAINER_PAD_BOTTOM,
    });
    g.setDefaultNodeLabel(() => ({}));
    g.setDefaultEdgeLabel(() => ({}));

    // Add nodes with their sizes
    for (const id of childIds) {
      const node = nodeMap.get(id)!;
      // Use computed size if this node was already laid out as a container
      const computed = computedSizes.get(id);
      const w = computed?.width ?? node.measured?.width ?? (node.width as number | undefined) ?? 250;
      const h = computed?.height ?? node.measured?.height ?? (node.height as number | undefined) ?? 150;
      g.setNode(id, { width: w, height: h });
    }

    // Add edges that connect nodes within this group
    const childSet = new Set(childIds);
    for (const edge of edges) {
      if (childSet.has(edge.source) && childSet.has(edge.target)) {
        g.setEdge(edge.source, edge.target);
      }
    }

    // Run layout
    dagre.layout(g);

    // Extract positions (dagre gives center coordinates, convert to top-left)
    for (const id of childIds) {
      const layoutNode = g.node(id);
      if (!layoutNode) continue;
      positions.set(id, {
        x: layoutNode.x - layoutNode.width / 2,
        y: layoutNode.y - layoutNode.height / 2,
      });
    }

    // If this group has a parent, compute the parent container's size
    if (parentId !== undefined) {
      let maxRight = 0;
      let maxBottom = 0;
      for (const id of childIds) {
        const pos = positions.get(id)!;
        const node = nodeMap.get(id)!;
        const computed = computedSizes.get(id);
        const w = computed?.width ?? node.measured?.width ?? (node.width as number | undefined) ?? 250;
        const h = computed?.height ?? node.measured?.height ?? (node.height as number | undefined) ?? 150;
        maxRight = Math.max(maxRight, pos.x + w);
        maxBottom = Math.max(maxBottom, pos.y + h);
      }

      // Offset all children to account for header
      for (const id of childIds) {
        const pos = positions.get(id)!;
        pos.y += HEADER_HEIGHT;
      }

      computedSizes.set(parentId, {
        width: maxRight + CONTAINER_PAD_X,
        height: maxBottom + HEADER_HEIGHT + CONTAINER_PAD_BOTTOM,
      });
    }
  }

  // Apply positions and sizes to diagram nodes
  diagram.nodes = diagram.nodes.map((n) => {
    const pos = positions.get(n.id);
    const size = computedSizes.get(n.id);

    const schema = registry.getResourceSchema(n.type as ResourceTypeId);
    const isContainer = schema?.isContainer ?? false;

    return {
      ...n,
      position: pos ?? n.position,
      ...(isContainer && size
        ? {
            width: size.width,
            height: size.height,
            style: `width: ${size.width}px; height: ${size.height}px;`,
          }
        : {}),
    };
  });

  diagram.saveSnapshot();
}

/**
 * Get group parentIds in bottom-up order (deepest nesting first).
 */
function getBottomUpOrder(
  groups: Map<string | undefined, string[]>,
  nodeMap: Map<string, { parentId?: string | number }>,
): (string | undefined)[] {
  // Compute depth for each parentId
  const depths = new Map<string | undefined, number>();

  function getDepth(parentId: string | undefined): number {
    if (parentId === undefined) return 0;
    if (depths.has(parentId)) return depths.get(parentId)!;

    const node = nodeMap.get(parentId);
    const grandParent = node?.parentId as string | undefined;
    const depth = 1 + getDepth(grandParent);
    depths.set(parentId, depth);
    return depth;
  }

  for (const parentId of groups.keys()) {
    getDepth(parentId);
  }

  // Sort: deepest first, undefined (root) last
  return [...groups.keys()].sort((a, b) => {
    const da = a === undefined ? -1 : (depths.get(a) ?? 0);
    const db = b === undefined ? -1 : (depths.get(b) ?? 0);
    return db - da;
  });
}
