<script lang="ts">
  import type { ModuleInstance } from '@terrastudio/types';
  import { diagram, type DiagramNode } from '$lib/stores/diagram.svelte';

  let {
    instance,
    onselect,
    oncollapse,
    screenToFlowPosition,
  }: {
    instance: ModuleInstance;
    onselect: (instanceId: string) => void;
    oncollapse: (instanceId: string) => void;
    screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number };
  } = $props();

  const PADDING = 24;
  const BORDER_HIT = PADDING;

  const template = $derived(diagram.modules.find((m) => m.id === instance.templateId));

  function getAbsolutePosition(node: DiagramNode): { x: number; y: number } {
    let x = node.position.x;
    let y = node.position.y;
    let parentId = node.parentId as string | undefined;

    while (parentId) {
      const parent = diagram.nodes.find((n) => n.id === parentId);
      if (!parent) break;
      x += parent.position.x;
      y += parent.position.y;
      parentId = parent.parentId as string | undefined;
    }

    return { x, y };
  }

  /** Cloned member nodes for this instance (prefixed with `_instmem_{id}_`) */
  const clonePrefix = $derived(`_instmem_${instance.id}_`);

  const bounds = $derived.by(() => {
    const members = diagram.nodes.filter((n) => n.id.startsWith(clonePrefix));
    if (members.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of members) {
      const abs = getAbsolutePosition(node);
      const w = node.measured?.width ?? (node.width as number | undefined) ?? 250;
      const h = node.measured?.height ?? (node.height as number | undefined) ?? 100;

      if (abs.x < minX) minX = abs.x;
      if (abs.y < minY) minY = abs.y;
      if (abs.x + w > maxX) maxX = abs.x + w;
      if (abs.y + h > maxY) maxY = abs.y + h;
    }

    return {
      x: minX - PADDING,
      y: minY - PADDING,
      width: maxX - minX + PADDING * 2,
      height: maxY - minY + PADDING * 2,
    };
  });

  const borderColor = $derived(instance.color ?? template?.color ?? '#6366f1');
  const isSelected = $derived(diagram.selectedNodeId === `_modinst_${instance.id}`);
  const memberCount = $derived(
    diagram.nodes.filter((n) => n.id.startsWith(clonePrefix)).length,
  );
  const varCount = $derived(
    Object.keys(instance.variableValues).filter((k) => instance.variableValues[k] !== undefined && instance.variableValues[k] !== '').length,
  );

  // ── Drag ────────────────────────────────────────────────
  let dragging = $state(false);
  let dragStartFlow = $state<{ x: number; y: number } | null>(null);
  let dragNodeSnapshots = $state<Map<string, { x: number; y: number }> | null>(null);
  let captureEl = $state<HTMLElement | null>(null);

  function getRootMovers(): DiagramNode[] {
    const clonedMembers = diagram.nodes.filter((n) => n.id.startsWith(clonePrefix));
    const clonedIds = new Set(clonedMembers.map((n) => n.id));
    // Root movers are cloned nodes whose parent is NOT also a clone
    return clonedMembers.filter(
      (n) => !clonedIds.has(n.parentId as string),
    );
  }

  function startDrag(e: PointerEvent) {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    dragging = true;
    dragStartFlow = screenToFlowPosition({ x: e.clientX, y: e.clientY });

    const snapshots = new Map<string, { x: number; y: number }>();
    for (const node of getRootMovers()) {
      snapshots.set(node.id, { x: node.position.x, y: node.position.y });
    }
    dragNodeSnapshots = snapshots;

    diagram.saveSnapshot();

    captureEl = e.currentTarget as HTMLElement;
    captureEl.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging || !dragStartFlow || !dragNodeSnapshots) return;
    e.preventDefault();

    const currentFlow = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const dx = currentFlow.x - dragStartFlow.x;
    const dy = currentFlow.y - dragStartFlow.y;

    diagram.nodes = diagram.nodes.map((n) => {
      const snap = dragNodeSnapshots!.get(n.id);
      if (!snap) return n;
      return { ...n, position: { x: snap.x + dx, y: snap.y + dy } };
    });
  }

  function onPointerUp(e: PointerEvent) {
    if (!dragging) return;
    dragging = false;
    dragStartFlow = null;
    dragNodeSnapshots = null;
    if (captureEl) {
      captureEl.releasePointerCapture(e.pointerId);
      captureEl = null;
    }
  }

  function onHeaderPointerDown(e: PointerEvent) {
    const target = e.target as HTMLElement;
    if (target.closest('.collapse-btn')) return;
    startDrag(e);
  }
</script>

{#if bounds}
  <div
    class="instance-boundary"
    class:selected={isSelected}
    class:dragging
    style:left="{bounds.x}px"
    style:top="{bounds.y}px"
    style:width="{bounds.width}px"
    style:height="{bounds.height}px"
    style:--instance-color={borderColor}
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="border-strip border-top"
      style:height="{BORDER_HIT}px"
      onpointerdown={startDrag}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onclick={(e) => { e.stopPropagation(); onselect(instance.id); }}
    ></div>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="border-strip border-bottom"
      style:height="{BORDER_HIT}px"
      onpointerdown={startDrag}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onclick={(e) => { e.stopPropagation(); onselect(instance.id); }}
    ></div>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="border-strip border-left"
      style:width="{BORDER_HIT}px"
      style:top="{BORDER_HIT}px"
      style:bottom="{BORDER_HIT}px"
      onpointerdown={startDrag}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onclick={(e) => { e.stopPropagation(); onselect(instance.id); }}
    ></div>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="border-strip border-right"
      style:width="{BORDER_HIT}px"
      style:top="{BORDER_HIT}px"
      style:bottom="{BORDER_HIT}px"
      onpointerdown={startDrag}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onclick={(e) => { e.stopPropagation(); onselect(instance.id); }}
    ></div>

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="instance-header"
      class:dragging
      onpointerdown={onHeaderPointerDown}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
    >
      <button
        class="collapse-btn"
        title="Collapse instance"
        onclick={(e) => { e.stopPropagation(); oncollapse(instance.id); }}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      <span class="instance-badge-tag">INSTANCE</span>
      <span class="instance-name">{instance.name}</span>
      <span class="member-badge">{memberCount}</span>
      {#if varCount > 0}
        <span class="var-badge">{varCount} var{varCount !== 1 ? 's' : ''}</span>
      {/if}
    </div>

    <!-- Read-only overlay hint -->
    <div class="readonly-hint">read-only</div>
  </div>
{/if}

<style>
  .instance-boundary {
    position: absolute;
    border: 2.5px dashed var(--instance-color);
    border-radius: 10px;
    pointer-events: none;
    background: color-mix(in srgb, var(--instance-color) 4%, transparent);
    transition: border-color 0.15s, background 0.15s;
    z-index: 1000;
  }

  .instance-boundary.selected {
    border-style: solid;
    border-width: 3px;
    background: color-mix(in srgb, var(--instance-color) 8%, transparent);
  }

  .border-strip {
    position: absolute;
    pointer-events: auto;
    cursor: grab;
    touch-action: none;
  }

  .dragging .border-strip {
    cursor: grabbing;
  }

  .border-top { top: 0; left: 0; right: 0; }
  .border-bottom { bottom: 0; left: 0; right: 0; }
  .border-left { left: 0; }
  .border-right { right: 0; }

  .instance-header {
    position: absolute;
    top: -32px;
    left: 0;
    height: 30px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 10px;
    pointer-events: auto;
    cursor: grab;
    border-radius: 6px 6px 0 0;
    background: var(--instance-color);
    opacity: 0.9;
    z-index: 1001;
    touch-action: none;
  }

  .instance-header.dragging {
    cursor: grabbing;
  }

  .instance-name {
    font-size: 12px;
    font-weight: 600;
    color: white;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    user-select: none;
  }

  .member-badge {
    font-size: 10px;
    font-weight: 600;
    color: var(--instance-color);
    background: white;
    border-radius: 8px;
    padding: 1px 6px;
    min-width: 18px;
    text-align: center;
    user-select: none;
  }

  .instance-badge-tag {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.5px;
    color: var(--instance-color);
    background: white;
    border-radius: 4px;
    padding: 1px 4px;
    user-select: none;
  }

  .var-badge {
    font-size: 10px;
    font-weight: 600;
    color: white;
    opacity: 0.7;
    user-select: none;
    white-space: nowrap;
  }

  .collapse-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: none;
    background: none;
    color: white;
    cursor: pointer;
    border-radius: 4px;
    padding: 0;
    flex-shrink: 0;
  }

  .collapse-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .readonly-hint {
    position: absolute;
    bottom: 4px;
    right: 8px;
    font-size: 10px;
    color: var(--instance-color);
    opacity: 0.5;
    pointer-events: none;
    user-select: none;
    font-style: italic;
  }
</style>
