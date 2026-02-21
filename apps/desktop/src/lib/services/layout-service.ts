import dagre from '@dagrejs/dagre';
import type { ResourceTypeId } from '@terrastudio/types';
import type { PluginRegistry } from '@terrastudio/core';
import { diagram } from '$lib/stores/diagram.svelte';
import { project } from '$lib/stores/project.svelte';

const HEADER_HEIGHT = 40;
const CONTAINER_PAD_X = 20;
const CONTAINER_PAD_BOTTOM = 20;
const NODE_SEP = 40;
const RANK_SEP = 60;
const DEFAULT_LEAF_WIDTH = 250;
const DEFAULT_LEAF_HEIGHT = 80;
const DEFAULT_CONTAINER_HEIGHT = 150;

export type LayoutDirection = 'TB' | 'BT' | 'LR' | 'RL';

type DiagramNode = (typeof diagram.nodes)[number];

// ---------------------------------------------------------------------------
// Public entry point — dispatches to the chosen algorithm
// ---------------------------------------------------------------------------

/**
 * Auto-layout all diagram nodes.
 * Reads `project.projectConfig.layoutAlgorithm` to pick the algorithm.
 */
export function autoLayout(registry: PluginRegistry, direction: LayoutDirection = 'TB'): void {
  const algo = project.projectConfig.layoutAlgorithm ?? 'dagre';
  if (algo === 'hybrid') {
    hybridLayout(registry, direction);
  } else {
    dagreLayout(registry, direction);
  }
}

// ===========================================================================
// Algorithm 1: Dagre (original hierarchical layout)
// ===========================================================================

function dagreLayout(registry: PluginRegistry, direction: LayoutDirection): void {
  const nodes = diagram.nodes;
  const edges = diagram.edges;
  if (nodes.length === 0) return;

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const groups = new Map<string | undefined, string[]>();
  for (const node of nodes) {
    const parentId = node.parentId as string | undefined;
    const list = groups.get(parentId) ?? [];
    list.push(node.id);
    groups.set(parentId, list);
  }

  const processOrder = getBottomUpOrder(groups, nodeMap);
  const positions = new Map<string, { x: number; y: number }>();
  const computedSizes = new Map<string, { width: number; height: number }>();

  for (const parentId of processOrder) {
    const childIds = groups.get(parentId) ?? [];
    if (childIds.length === 0) continue;

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

    for (const id of childIds) {
      const { width, height } = getNodeSize(id, nodeMap, computedSizes, registry);
      g.setNode(id, { width, height });
    }

    const childSet = new Set(childIds);
    for (const edge of edges) {
      if (childSet.has(edge.source) && childSet.has(edge.target)) {
        g.setEdge(edge.source, edge.target);
      }
    }

    dagre.layout(g);

    for (const id of childIds) {
      const layoutNode = g.node(id);
      if (!layoutNode) continue;
      positions.set(id, {
        x: layoutNode.x - layoutNode.width / 2,
        y: layoutNode.y - layoutNode.height / 2,
      });
    }

    if (parentId !== undefined) {
      let maxRight = 0;
      let maxBottom = 0;
      for (const id of childIds) {
        const pos = positions.get(id)!;
        const { width, height } = getNodeSize(id, nodeMap, computedSizes, registry);
        maxRight = Math.max(maxRight, pos.x + width);
        maxBottom = Math.max(maxBottom, pos.y + height);
      }

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

  applyLayout(registry, positions, computedSizes);
}

// ===========================================================================
// Algorithm 2: Hybrid Grid + Dagre
// ===========================================================================

interface LayoutEdge {
  source: string;
  target: string;
}

interface LayoutBlock {
  nodeIds: string[];
  width: number;
  height: number;
  positions: Map<string, { x: number; y: number }>;
  sortKey: number; // 0 = container, 1 = cluster, 2 = single
}

class UnionFind {
  private parent = new Map<string, string>();
  private rank = new Map<string, number>();

  makeSet(x: string): void {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
  }

  find(x: string): string {
    if (this.parent.get(x) !== x) {
      this.parent.set(x, this.find(this.parent.get(x)!));
    }
    return this.parent.get(x)!;
  }

  union(x: string, y: string): void {
    const rx = this.find(x);
    const ry = this.find(y);
    if (rx === ry) return;
    const rankX = this.rank.get(rx)!;
    const rankY = this.rank.get(ry)!;
    if (rankX < rankY) {
      this.parent.set(rx, ry);
    } else if (rankX > rankY) {
      this.parent.set(ry, rx);
    } else {
      this.parent.set(ry, rx);
      this.rank.set(rx, rankX + 1);
    }
  }
}

function hybridLayout(registry: PluginRegistry, direction: LayoutDirection): void {
  const nodes = diagram.nodes;
  const edges = diagram.edges;
  if (nodes.length === 0) return;

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const groups = new Map<string | undefined, string[]>();
  for (const node of nodes) {
    const parentId = node.parentId as string | undefined;
    const list = groups.get(parentId) ?? [];
    list.push(node.id);
    groups.set(parentId, list);
  }

  const processOrder = getBottomUpOrder(groups, nodeMap);
  const positions = new Map<string, { x: number; y: number }>();
  const computedSizes = new Map<string, { width: number; height: number }>();

  for (const parentId of processOrder) {
    const childIds = groups.get(parentId) ?? [];
    if (childIds.length === 0) continue;

    const childSet = new Set(childIds);

    // Synthesize virtual edges from property-based references
    const virtualEdges = synthesizeVirtualEdges(childIds, childSet, nodeMap, registry);
    const combinedEdges = combineEdges(childSet, edges, virtualEdges);

    // Find connected components
    const components = findComponents(childIds, combinedEdges);

    // Build layout blocks
    const blocks: LayoutBlock[] = [];
    for (const [, componentIds] of components) {
      if (componentIds.length === 1) {
        blocks.push(makeSingleBlock(componentIds[0], nodeMap, computedSizes, registry));
      } else {
        const compSet = new Set(componentIds);
        const compEdges = combinedEdges.filter(
          (e) => compSet.has(e.source) && compSet.has(e.target),
        );
        blocks.push(
          layoutCluster(componentIds, compEdges, nodeMap, computedSizes, registry, direction),
        );
      }
    }

    // Arrange blocks in grid
    const groupPositions = arrangeBlocksInGrid(blocks, direction);

    for (const [id, pos] of groupPositions) {
      positions.set(id, pos);
    }

    // Size parent container
    if (parentId !== undefined) {
      for (const id of childIds) {
        const pos = positions.get(id);
        if (pos) pos.y += HEADER_HEIGHT;
      }

      let maxRight = 0;
      let maxBottom = 0;
      for (const id of childIds) {
        const pos = positions.get(id)!;
        const { width, height } = getNodeSize(id, nodeMap, computedSizes, registry);
        maxRight = Math.max(maxRight, pos.x + width);
        maxBottom = Math.max(maxBottom, pos.y + height);
      }

      computedSizes.set(parentId, {
        width: maxRight + CONTAINER_PAD_X,
        height: maxBottom + CONTAINER_PAD_BOTTOM,
      });
    }
  }

  applyLayout(registry, positions, computedSizes);
}

// ---------------------------------------------------------------------------
// Hybrid helpers
// ---------------------------------------------------------------------------

function synthesizeVirtualEdges(
  childIds: string[],
  childSet: Set<string>,
  nodeMap: Map<string, DiagramNode>,
  registry: PluginRegistry,
): LayoutEdge[] {
  const edges: LayoutEdge[] = [];

  for (const id of childIds) {
    const node = nodeMap.get(id)!;
    const schema = registry.getResourceSchema(node.type as ResourceTypeId);
    const parentRefKey = schema?.parentReference?.propertyKey;
    const refs = (node.data as { references?: Record<string, string> }).references;
    if (!refs) continue;

    for (const [refKey, targetId] of Object.entries(refs)) {
      if (refKey === parentRefKey) continue;
      if (!childSet.has(targetId)) continue;
      edges.push({ source: targetId, target: id });
    }
  }

  return edges;
}

function combineEdges(
  childSet: Set<string>,
  realEdges: { source: string; target: string }[],
  virtualEdges: LayoutEdge[],
): LayoutEdge[] {
  const seen = new Set<string>();
  const combined: LayoutEdge[] = [];

  for (const edge of realEdges) {
    if (childSet.has(edge.source) && childSet.has(edge.target)) {
      const key = `${edge.source}->${edge.target}`;
      if (!seen.has(key)) {
        seen.add(key);
        combined.push({ source: edge.source, target: edge.target });
      }
    }
  }

  for (const ve of virtualEdges) {
    const key = `${ve.source}->${ve.target}`;
    if (!seen.has(key)) {
      seen.add(key);
      combined.push(ve);
    }
  }

  return combined;
}

function findComponents(
  childIds: string[],
  edges: LayoutEdge[],
): Map<string, string[]> {
  const uf = new UnionFind();
  for (const id of childIds) uf.makeSet(id);
  for (const e of edges) uf.union(e.source, e.target);

  const components = new Map<string, string[]>();
  for (const id of childIds) {
    const root = uf.find(id);
    const list = components.get(root) ?? [];
    list.push(id);
    components.set(root, list);
  }
  return components;
}

function layoutCluster(
  nodeIds: string[],
  edges: LayoutEdge[],
  nodeMap: Map<string, DiagramNode>,
  computedSizes: Map<string, { width: number; height: number }>,
  registry: PluginRegistry,
  direction: LayoutDirection,
): LayoutBlock {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: direction, nodesep: NODE_SEP, ranksep: RANK_SEP, marginx: 0, marginy: 0 });
  g.setDefaultNodeLabel(() => ({}));
  g.setDefaultEdgeLabel(() => ({}));

  const nodeIdSet = new Set(nodeIds);

  for (const id of nodeIds) {
    const { width, height } = getNodeSize(id, nodeMap, computedSizes, registry);
    g.setNode(id, { width, height });
  }

  for (const e of edges) {
    if (nodeIdSet.has(e.source) && nodeIdSet.has(e.target)) {
      g.setEdge(e.source, e.target);
    }
  }

  dagre.layout(g);

  const positions = new Map<string, { x: number; y: number }>();
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const id of nodeIds) {
    const ln = g.node(id);
    if (!ln) continue;
    const x = ln.x - ln.width / 2;
    const y = ln.y - ln.height / 2;
    positions.set(id, { x, y });
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + ln.width);
    maxY = Math.max(maxY, y + ln.height);
  }

  for (const pos of positions.values()) {
    pos.x -= minX;
    pos.y -= minY;
  }

  let hasContainer = false;
  for (const id of nodeIds) {
    const node = nodeMap.get(id)!;
    const schema = registry.getResourceSchema(node.type as ResourceTypeId);
    if (schema?.isContainer) {
      hasContainer = true;
      break;
    }
  }

  return {
    nodeIds,
    width: maxX - minX,
    height: maxY - minY,
    positions,
    sortKey: hasContainer ? 0 : 1,
  };
}

function makeSingleBlock(
  id: string,
  nodeMap: Map<string, DiagramNode>,
  computedSizes: Map<string, { width: number; height: number }>,
  registry: PluginRegistry,
): LayoutBlock {
  const { width, height } = getNodeSize(id, nodeMap, computedSizes, registry);
  const schema = registry.getResourceSchema(nodeMap.get(id)!.type as ResourceTypeId);

  return {
    nodeIds: [id],
    width,
    height,
    positions: new Map([[id, { x: 0, y: 0 }]]),
    sortKey: schema?.isContainer ? 0 : 2,
  };
}

function arrangeBlocksInGrid(
  blocks: LayoutBlock[],
  direction: LayoutDirection,
): Map<string, { x: number; y: number }> {
  if (blocks.length === 0) return new Map();

  blocks.sort((a, b) => {
    if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
    return b.width * b.height - a.width * a.height;
  });

  const n = blocks.length;
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
  const globalPositions = new Map<string, { x: number; y: number }>();
  const isVertical = direction === 'TB' || direction === 'BT';

  if (isVertical) {
    const colWidths: number[] = new Array(cols).fill(0);
    const rowHeights: number[] = [];
    const rows = Math.ceil(n / cols);

    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      colWidths[col] = Math.max(colWidths[col], blocks[i].width);
      if (rowHeights[row] === undefined) rowHeights[row] = 0;
      rowHeights[row] = Math.max(rowHeights[row], blocks[i].height);
    }

    const colOffsets = [0];
    for (let c = 1; c < cols; c++) {
      colOffsets[c] = colOffsets[c - 1] + colWidths[c - 1] + NODE_SEP;
    }
    const rowOffsets = [0];
    for (let r = 1; r < rows; r++) {
      rowOffsets[r] = rowOffsets[r - 1] + rowHeights[r - 1] + NODE_SEP;
    }

    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const block = blocks[i];
      const bx = colOffsets[col];
      const by = rowOffsets[row];

      for (const [nodeId, relPos] of block.positions) {
        globalPositions.set(nodeId, { x: bx + relPos.x, y: by + relPos.y });
      }
    }
  } else {
    const rowCount = cols;
    const colCount = Math.ceil(n / rowCount);
    const colWidths: number[] = new Array(colCount).fill(0);
    const rowHeights: number[] = new Array(rowCount).fill(0);

    for (let i = 0; i < n; i++) {
      const col = Math.floor(i / rowCount);
      const row = i % rowCount;
      colWidths[col] = Math.max(colWidths[col], blocks[i].width);
      rowHeights[row] = Math.max(rowHeights[row], blocks[i].height);
    }

    const colOffsets = [0];
    for (let c = 1; c < colCount; c++) {
      colOffsets[c] = colOffsets[c - 1] + colWidths[c - 1] + NODE_SEP;
    }
    const rowOffsets = [0];
    for (let r = 1; r < rowCount; r++) {
      rowOffsets[r] = rowOffsets[r - 1] + rowHeights[r - 1] + NODE_SEP;
    }

    for (let i = 0; i < n; i++) {
      const col = Math.floor(i / rowCount);
      const row = i % rowCount;
      const block = blocks[i];
      const bx = colOffsets[col];
      const by = rowOffsets[row];

      for (const [nodeId, relPos] of block.positions) {
        globalPositions.set(nodeId, { x: bx + relPos.x, y: by + relPos.y });
      }
    }
  }

  return globalPositions;
}

// ===========================================================================
// Shared helpers
// ===========================================================================

function getNodeSize(
  id: string,
  nodeMap: Map<string, DiagramNode>,
  computedSizes: Map<string, { width: number; height: number }>,
  registry: PluginRegistry,
): { width: number; height: number } {
  const computed = computedSizes.get(id);
  if (computed) return computed;

  const node = nodeMap.get(id)!;
  const schema = registry.getResourceSchema(node.type as ResourceTypeId);
  const isContainer = schema?.isContainer ?? false;

  const w =
    node.measured?.width ?? (node.width as number | undefined) ?? DEFAULT_LEAF_WIDTH;
  const h =
    node.measured?.height ??
    (node.height as number | undefined) ??
    (isContainer ? DEFAULT_CONTAINER_HEIGHT : DEFAULT_LEAF_HEIGHT);

  return { width: w, height: h };
}

function applyLayout(
  registry: PluginRegistry,
  positions: Map<string, { x: number; y: number }>,
  computedSizes: Map<string, { width: number; height: number }>,
): void {
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

function getBottomUpOrder(
  groups: Map<string | undefined, string[]>,
  nodeMap: Map<string, { parentId?: string | number }>,
): (string | undefined)[] {
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

  return [...groups.keys()].sort((a, b) => {
    const da = a === undefined ? -1 : (depths.get(a) ?? 0);
    const db = b === undefined ? -1 : (depths.get(b) ?? 0);
    return db - da;
  });
}
