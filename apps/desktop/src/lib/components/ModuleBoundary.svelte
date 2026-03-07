<script lang="ts">
  import type { ModuleDefinition } from '@terrastudio/types';
  import { diagram, type DiagramNode } from '$lib/stores/diagram.svelte';
  import { t } from '$lib/i18n';

  let {
    module,
    onselect,
    ontogglecollapse,
    oncreateinstance,
    screenToFlowPosition,
  }: {
    module: ModuleDefinition;
    onselect: (moduleId: string) => void;
    ontogglecollapse: (moduleId: string) => void;
    oncreateinstance?: (moduleId: string) => void;
    screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number };
  } = $props();

  const PADDING = 24;
  /** Width of the interactive drag border — matches PADDING so the entire
   *  background area between the dashed border and the nodes is draggable. */
  const BORDER_HIT = PADDING;

  /**
   * Compute absolute position for a node by walking up the parent chain.
   */
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

  /** Compute bounding box of all member nodes in absolute flow coordinates. */
  const bounds = $derived.by(() => {
    const members = diagram.nodes.filter((n) => n.data.moduleId === module.id);
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

  const borderColor = $derived(module.color ?? '#6366f1');
  const isSelected = $derived(diagram.selectedModuleId === module.id);
  const memberCount = $derived(diagram.nodes.filter((n) => n.data.moduleId === module.id).length);
  const isTemplate = $derived(module.isTemplate === true);
  const instanceCount = $derived(
    isTemplate ? diagram.moduleInstances.filter((i) => i.templateId === module.id).length : 0,
  );

  // ── Module drag ────────────────────────────────────────────────
  let dragging = $state(false);
  let dragStartFlow = $state<{ x: number; y: number } | null>(null);
  let dragNodeSnapshots = $state<Map<string, { x: number; y: number }> | null>(null);
  /** The element that captured the pointer (header or a border strip) */
  let captureEl = $state<HTMLElement | null>(null);

  /**
   * Get the "root movers" — module member nodes that should be directly moved.
   * A node is a root mover if its parent is NOT also a module member.
   * Child nodes move automatically when their parent moves.
   */
  function getRootMovers(): DiagramNode[] {
    const memberIds = new Set(
      diagram.nodes.filter((n) => n.data.moduleId === module.id).map((n) => n.id),
    );
    return diagram.nodes.filter(
      (n) => memberIds.has(n.id) && !memberIds.has(n.parentId as string),
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
    // Don't start drag if clicking the collapse button
    const target = e.target as HTMLElement;
    if (target.closest('.collapse-btn')) return;
    startDrag(e);
  }
</script>

{#if bounds}
  <!-- Boundary wrapper: pointer-events: none so interior clicks pass through to nodes -->
  <div
    class="module-boundary"
    class:selected={isSelected}
    class:dragging
    style:left="{bounds.x}px"
    style:top="{bounds.y}px"
    style:width="{bounds.width}px"
    style:height="{bounds.height}px"
    style:--module-color={borderColor}
  >
    <!-- Four interactive border strips for drag from edges -->
    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
    <div
      class="border-strip border-top"
      style:height="{BORDER_HIT}px"
      onpointerdown={startDrag}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onclick={(e) => { e.stopPropagation(); onselect(module.id); }}
    ></div>
    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
    <div
      class="border-strip border-bottom"
      style:height="{BORDER_HIT}px"
      onpointerdown={startDrag}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onclick={(e) => { e.stopPropagation(); onselect(module.id); }}
    ></div>
    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
    <div
      class="border-strip border-left"
      style:width="{BORDER_HIT}px"
      style:top="{BORDER_HIT}px"
      style:bottom="{BORDER_HIT}px"
      onpointerdown={startDrag}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onclick={(e) => { e.stopPropagation(); onselect(module.id); }}
    ></div>
    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
    <div
      class="border-strip border-right"
      style:width="{BORDER_HIT}px"
      style:top="{BORDER_HIT}px"
      style:bottom="{BORDER_HIT}px"
      onpointerdown={startDrag}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onclick={(e) => { e.stopPropagation(); onselect(module.id); }}
    ></div>

    <!-- Header tab -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="module-header"
      class:dragging
      onpointerdown={onHeaderPointerDown}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
    >
      <button
        class="collapse-btn"
        title={t('module.collapseModule')}
        onclick={(e) => { e.stopPropagation(); ontogglecollapse(module.id); }}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {#if isTemplate}
        <span class="template-badge">{t('module.templateBadge')}</span>
      {/if}
      <span class="module-name">{module.name}</span>
      <span class="module-badge">{memberCount}</span>
      {#if isTemplate}
        <span class="instance-count" title="{instanceCount} instance{instanceCount !== 1 ? 's' : ''}">{instanceCount}</span>
        <button
          class="create-instance-btn"
          title={t('module.createInstance')}
          onclick={(e) => { e.stopPropagation(); oncreateinstance?.(module.id); }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 3v10" /><path d="M3 8h10" />
          </svg>
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .module-boundary {
    position: absolute;
    border: 2.5px dashed var(--module-color);
    border-radius: 10px;
    pointer-events: none;
    background: color-mix(in srgb, var(--module-color) 6%, transparent);
    transition: border-color 0.15s, background 0.15s;
    z-index: 1000;
  }

  .module-boundary.selected {
    border-style: solid;
    border-width: 3px;
    background: color-mix(in srgb, var(--module-color) 10%, transparent);
  }

  /* Interactive border strips — only the edges of the boundary respond to pointer */
  .border-strip {
    position: absolute;
    pointer-events: auto;
    cursor: grab;
    touch-action: none;
  }

  .dragging .border-strip {
    cursor: grabbing;
  }

  .border-top {
    top: 0;
    left: 0;
    right: 0;
  }

  .border-bottom {
    bottom: 0;
    left: 0;
    right: 0;
  }

  .border-left {
    left: 0;
  }

  .border-right {
    right: 0;
  }

  .module-header {
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
    background: var(--module-color);
    opacity: 0.9;
    z-index: 1001;
    touch-action: none;
  }

  .module-header.dragging {
    cursor: grabbing;
  }

  .module-name {
    font-size: var(--font-12);
    font-weight: 600;
    color: white;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    user-select: none;
  }

  .module-badge {
    font-size: var(--font-10);
    font-weight: 600;
    color: var(--module-color);
    background: white;
    border-radius: 8px;
    padding: 1px 6px;
    min-width: 18px;
    text-align: center;
    user-select: none;
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

  .template-badge {
    font-size: var(--font-9);
    font-weight: 700;
    letter-spacing: 0.5px;
    color: var(--module-color);
    background: white;
    border-radius: 4px;
    padding: 1px 4px;
    user-select: none;
  }

  .instance-count {
    font-size: var(--font-10);
    font-weight: 600;
    color: white;
    opacity: 0.7;
    user-select: none;
  }

  .create-instance-btn {
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

  .create-instance-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }
</style>
