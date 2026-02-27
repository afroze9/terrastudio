import { diagram, type DiagramNode } from '$lib/stores/diagram.svelte';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSelectedNodes(): DiagramNode[] {
  return diagram.nodes.filter((n) => n.selected);
}

function nodeW(n: DiagramNode): number {
  return n.measured?.width ?? (n.width as number | undefined) ?? 250;
}

function nodeH(n: DiagramNode): number {
  return n.measured?.height ?? (n.height as number | undefined) ?? 80;
}

/** Walk up the parent chain to compute absolute flow position for a node. */
function getAbsolutePosition(nodeId: string): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let currentId: string | undefined = nodeId;
  while (currentId) {
    const node = diagram.nodes.find((n) => n.id === currentId);
    if (!node) break;
    x += node.position.x;
    y += node.position.y;
    currentId = node.parentId as string | undefined;
  }
  return { x, y };
}

/** Get the absolute position of a node's parent (or {0,0} if top-level). */
function getParentAbsolutePosition(node: DiagramNode): { x: number; y: number } {
  const parentId = node.parentId as string | undefined;
  if (!parentId) return { x: 0, y: 0 };
  return getAbsolutePosition(parentId);
}

/**
 * Convert an absolute position to the parent-relative position for a given node.
 */
function absoluteToRelative(node: DiagramNode, absX: number, absY: number): { x: number; y: number } {
  const parentAbs = getParentAbsolutePosition(node);
  return { x: absX - parentAbs.x, y: absY - parentAbs.y };
}

/**
 * Update positions for a set of nodes by their id.
 * All position values are parent-relative (same coordinate space as node.position).
 */
function applyPositions(updates: Map<string, { x: number; y: number }>): void {
  diagram.nodes = diagram.nodes.map((n) => {
    const pos = updates.get(n.id);
    return pos ? { ...n, position: pos } : n;
  });
  diagram.saveSnapshot();
}

// ---------------------------------------------------------------------------
// Alignment — bounding box edge (Figma-style), absolute-coordinate-aware.
// Require >= 2 selected nodes.
// ---------------------------------------------------------------------------

export function alignLeft(): void {
  const nodes = getSelectedNodes();
  if (nodes.length < 2) return;
  const absPositions = nodes.map((n) => ({ node: n, abs: getAbsolutePosition(n.id) }));
  const minX = Math.min(...absPositions.map((a) => a.abs.x));
  const updates = new Map<string, { x: number; y: number }>();
  for (const { node, abs } of absPositions) {
    const rel = absoluteToRelative(node, minX, abs.y);
    updates.set(node.id, rel);
  }
  applyPositions(updates);
}

export function alignCenterH(): void {
  const nodes = getSelectedNodes();
  if (nodes.length < 2) return;
  const absPositions = nodes.map((n) => ({ node: n, abs: getAbsolutePosition(n.id) }));
  const minX = Math.min(...absPositions.map((a) => a.abs.x));
  const maxRight = Math.max(...absPositions.map((a) => a.abs.x + nodeW(a.node)));
  const centerX = (minX + maxRight) / 2;
  const updates = new Map<string, { x: number; y: number }>();
  for (const { node, abs } of absPositions) {
    const rel = absoluteToRelative(node, centerX - nodeW(node) / 2, abs.y);
    updates.set(node.id, rel);
  }
  applyPositions(updates);
}

export function alignRight(): void {
  const nodes = getSelectedNodes();
  if (nodes.length < 2) return;
  const absPositions = nodes.map((n) => ({ node: n, abs: getAbsolutePosition(n.id) }));
  const maxRight = Math.max(...absPositions.map((a) => a.abs.x + nodeW(a.node)));
  const updates = new Map<string, { x: number; y: number }>();
  for (const { node, abs } of absPositions) {
    const rel = absoluteToRelative(node, maxRight - nodeW(node), abs.y);
    updates.set(node.id, rel);
  }
  applyPositions(updates);
}

export function alignTop(): void {
  const nodes = getSelectedNodes();
  if (nodes.length < 2) return;
  const absPositions = nodes.map((n) => ({ node: n, abs: getAbsolutePosition(n.id) }));
  const minY = Math.min(...absPositions.map((a) => a.abs.y));
  const updates = new Map<string, { x: number; y: number }>();
  for (const { node, abs } of absPositions) {
    const rel = absoluteToRelative(node, abs.x, minY);
    updates.set(node.id, rel);
  }
  applyPositions(updates);
}

export function alignMiddleV(): void {
  const nodes = getSelectedNodes();
  if (nodes.length < 2) return;
  const absPositions = nodes.map((n) => ({ node: n, abs: getAbsolutePosition(n.id) }));
  const minY = Math.min(...absPositions.map((a) => a.abs.y));
  const maxBottom = Math.max(...absPositions.map((a) => a.abs.y + nodeH(a.node)));
  const centerY = (minY + maxBottom) / 2;
  const updates = new Map<string, { x: number; y: number }>();
  for (const { node, abs } of absPositions) {
    const rel = absoluteToRelative(node, abs.x, centerY - nodeH(node) / 2);
    updates.set(node.id, rel);
  }
  applyPositions(updates);
}

export function alignBottom(): void {
  const nodes = getSelectedNodes();
  if (nodes.length < 2) return;
  const absPositions = nodes.map((n) => ({ node: n, abs: getAbsolutePosition(n.id) }));
  const maxBottom = Math.max(...absPositions.map((a) => a.abs.y + nodeH(a.node)));
  const updates = new Map<string, { x: number; y: number }>();
  for (const { node, abs } of absPositions) {
    const rel = absoluteToRelative(node, abs.x, maxBottom - nodeH(node));
    updates.set(node.id, rel);
  }
  applyPositions(updates);
}

// ---------------------------------------------------------------------------
// Distribution — require >= 3 selected nodes.
// ---------------------------------------------------------------------------

export function distributeHorizontal(): void {
  const nodes = getSelectedNodes();
  if (nodes.length < 3) return;

  const absPositions = nodes.map((n) => ({ node: n, abs: getAbsolutePosition(n.id) }));
  // Sort by absolute x position
  const sorted = [...absPositions].sort((a, b) => a.abs.x - b.abs.x);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const totalSpan = (last.abs.x + nodeW(last.node)) - first.abs.x;
  const totalNodeWidth = sorted.reduce((sum, a) => sum + nodeW(a.node), 0);
  const gap = (totalSpan - totalNodeWidth) / (sorted.length - 1);

  const updates = new Map<string, { x: number; y: number }>();
  let currentX = first.abs.x;
  for (const { node, abs } of sorted) {
    const rel = absoluteToRelative(node, currentX, abs.y);
    updates.set(node.id, rel);
    currentX += nodeW(node) + gap;
  }
  applyPositions(updates);
}

export function distributeVertical(): void {
  const nodes = getSelectedNodes();
  if (nodes.length < 3) return;

  const absPositions = nodes.map((n) => ({ node: n, abs: getAbsolutePosition(n.id) }));
  // Sort by absolute y position
  const sorted = [...absPositions].sort((a, b) => a.abs.y - b.abs.y);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const totalSpan = (last.abs.y + nodeH(last.node)) - first.abs.y;
  const totalNodeHeight = sorted.reduce((sum, a) => sum + nodeH(a.node), 0);
  const gap = (totalSpan - totalNodeHeight) / (sorted.length - 1);

  const updates = new Map<string, { x: number; y: number }>();
  let currentY = first.abs.y;
  for (const { node, abs } of sorted) {
    const rel = absoluteToRelative(node, abs.x, currentY);
    updates.set(node.id, rel);
    currentY += nodeH(node) + gap;
  }
  applyPositions(updates);
}
