/**
 * Connection UX Store
 *
 * Manages the draw.io-inspired connection flow:
 * 1. Hover a node → directional arrows appear (top/right/bottom/left)
 * 2. Click an arrow → show handle menu for that side
 * 3. Click a handle in the menu → activate that handle (start drag)
 * 4. During drag → ghost handles appear on valid target nodes
 *
 * State machine: idle → hovering → showing-arrows → menu-open → dragging
 */

import type { ResourceTypeId } from '@terrastudio/types';

export type ConnectionUxState =
  | 'idle'
  | 'hovering'
  | 'showing-arrows'
  | 'menu-open'
  | 'dragging';

export type ArrowDirection = 'top' | 'right' | 'bottom' | 'left';

export interface HandleMenuEntry {
  handleId: string;
  label: string;
  type: 'source' | 'target';
  position: 'top' | 'right' | 'bottom' | 'left';
}

export interface GhostTarget {
  nodeId: string;
  handleId: string;
  handleType: 'source' | 'target';
  position: string;
}

class ConnectionUxStore {
  // State machine
  state = $state<ConnectionUxState>('idle');

  // Which node is currently being interacted with (arrows/menu)
  activeNodeId = $state<string | null>(null);
  activeNodeTypeId = $state<ResourceTypeId | null>(null);

  // Which direction arrow was clicked (for menu positioning)
  activeDirection = $state<ArrowDirection | null>(null);

  // Handles available in the open menu
  menuHandles = $state<HandleMenuEntry[]>([]);

  // During a drag: which nodes/handles should show as ghost targets
  ghostTargets = $state<GhostTarget[]>([]);

  // Track if a connection drag is in progress (from SvelteFlow)
  isDragging = $state(false);

  // The source info for the current drag
  dragSourceNodeId = $state<string | null>(null);
  dragSourceHandleId = $state<string | null>(null);


  // Timer for delayed arrow appearance
  private _hoverTimer: ReturnType<typeof setTimeout> | null = null;

  /** Node hover starts — transition to showing-arrows after ~1s delay */
  hoverNode(nodeId: string, typeId: ResourceTypeId) {
    // Don't override if we're already in a menu or drag for this node
    if (this.state === 'menu-open' && this.activeNodeId === nodeId) return;
    if (this.state === 'dragging') return;

    // Clear any existing timer
    if (this._hoverTimer) {
      clearTimeout(this._hoverTimer);
      this._hoverTimer = null;
    }

    this.activeNodeId = nodeId;
    this.activeNodeTypeId = typeId;
    this.state = 'hovering';

    this._hoverTimer = setTimeout(() => {
      // Only transition if still hovering the same node
      if (this.activeNodeId === nodeId && this.state === 'hovering') {
        this.state = 'showing-arrows';
      }
      this._hoverTimer = null;
    }, 800);
  }

  /** Node hover ends */
  unhoverNode(nodeId: string) {
    // Only reset if this is the node we're hovering
    if (this.activeNodeId !== nodeId) return;
    // Don't reset if menu is open or dragging
    if (this.state === 'menu-open' || this.state === 'dragging') return;

    // Clear pending hover timer
    if (this._hoverTimer) {
      clearTimeout(this._hoverTimer);
      this._hoverTimer = null;
    }

    this.state = 'idle';
    this.activeNodeId = null;
    this.activeNodeTypeId = null;
    this.activeDirection = null;
    this.menuHandles = [];
  }

  /** Arrow clicked — open handle menu for that direction */
  openMenu(direction: ArrowDirection, handles: HandleMenuEntry[]) {
    this.state = 'menu-open';
    this.activeDirection = direction;
    this.menuHandles = handles;
  }

  /** Close the menu (e.g., click outside, Escape) */
  closeMenu() {
    if (this.state !== 'menu-open') return;
    this.state = 'showing-arrows';
    this.activeDirection = null;
    this.menuHandles = [];
  }

  /** A handle was selected from the menu — begin connection drag */
  startDrag(sourceNodeId: string, sourceHandleId: string, ghostTargets: GhostTarget[]) {
    this.state = 'dragging';
    this.isDragging = true;
    this.dragSourceNodeId = sourceNodeId;
    this.dragSourceHandleId = sourceHandleId;
    this.ghostTargets = ghostTargets;
    this.activeDirection = null;
    this.menuHandles = [];
  }

  /** SvelteFlow's onconnectstart — external drag initiated by clicking a handle directly */
  onDragStart(sourceNodeId: string, sourceHandleId: string, ghostTargets: GhostTarget[]) {
    this.state = 'dragging';
    this.isDragging = true;
    this.dragSourceNodeId = sourceNodeId;
    this.dragSourceHandleId = sourceHandleId;
    this.ghostTargets = ghostTargets;
  }

  /** Connection drag ended (connected or cancelled) */
  endDrag() {
    this.state = 'idle';
    this.isDragging = false;
    this.activeNodeId = null;
    this.activeNodeTypeId = null;
    this.activeDirection = null;
    this.menuHandles = [];
    this.ghostTargets = [];
    this.dragSourceNodeId = null;
    this.dragSourceHandleId = null;
  }

  /** Reset everything */
  reset() {
    this.endDrag();
  }

  /** Check if a specific node should show ghost handles */
  hasGhostHandles(nodeId: string): boolean {
    return this.ghostTargets.some((t) => t.nodeId === nodeId);
  }

  /** Get ghost handles for a specific node */
  getGhostHandles(nodeId: string): GhostTarget[] {
    return this.ghostTargets.filter((t) => t.nodeId === nodeId);
  }
}

export const connectionUx = new ConnectionUxStore();
