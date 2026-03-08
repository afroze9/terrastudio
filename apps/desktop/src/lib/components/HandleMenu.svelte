<script lang="ts">
  import type { ArrowDirection, HandleMenuEntry } from '$lib/stores/connection-ux.svelte';
  import { onMount } from 'svelte';
  import type { Action } from 'svelte/action';

  let { handles, direction, pinnedIds, annotationCount, anchorEl, onToggle, onAddAnnotation, onRemoveAnnotation, onClose }: {
    handles: HandleMenuEntry[];
    direction: ArrowDirection;
    pinnedIds: Set<string>;
    annotationCount: number;
    anchorEl?: HTMLElement;
    onToggle: (handle: HandleMenuEntry) => void;
    onAddAnnotation: () => void;
    onRemoveAnnotation: () => void;
    onClose: () => void;
  } = $props();

  function handleToggle(h: HandleMenuEntry, event: PointerEvent | MouseEvent) {
    event.stopPropagation();
    event.stopImmediatePropagation();
    event.preventDefault();
    onToggle(h);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onClose();
    }
  }

  function stopAll(e: Event) {
    e.stopPropagation();
    e.stopImmediatePropagation();
  }

  function handleAddAnnotation(e: PointerEvent | MouseEvent) {
    e.stopPropagation();
    e.stopImmediatePropagation();
    e.preventDefault();
    onAddAnnotation();
  }

  function handleRemoveAnnotation(e: PointerEvent | MouseEvent) {
    e.stopPropagation();
    e.stopImmediatePropagation();
    e.preventDefault();
    onRemoveAnnotation();
  }

  const dirLabel: Record<string, string> = { top: 'top', right: 'right', bottom: 'bottom', left: 'left' };

  // Portal: render menu on document.body so it's above all panels
  let portalEl = $state<HTMLDivElement | null>(null);
  let posX = $state(0);
  let posY = $state(0);

  onMount(() => {
    const el = document.createElement('div');
    el.className = 'handle-menu-portal-container';
    document.body.appendChild(el);
    portalEl = el;

    return () => {
      if (el.parentNode) {
        document.body.removeChild(el);
      }
    };
  });

  // Compute fixed position from the anchor element's bounding rect
  $effect(() => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const GAP = 8;

    if (direction === 'top') {
      posX = rect.left + rect.width / 2;
      posY = rect.top - GAP;
    } else if (direction === 'bottom') {
      posX = rect.left + rect.width / 2;
      posY = rect.bottom + GAP;
    } else if (direction === 'left') {
      posX = rect.left - GAP;
      posY = rect.top + rect.height / 2;
    } else {
      posX = rect.right + GAP;
      posY = rect.top + rect.height / 2;
    }
  });

  const portal: Action<HTMLElement, HTMLElement> = (node, target) => {
    target.appendChild(node);
    return {
      destroy() {
        if (node.parentNode === target) {
          target.removeChild(node);
        }
      }
    };
  };

  // Transform origin based on direction (menu grows away from anchor)
  const transformMap: Record<string, string> = {
    top: 'translate(-50%, -100%)',
    bottom: 'translate(-50%, 0)',
    left: 'translate(-100%, -50%)',
    right: 'translate(0, -50%)',
  };
</script>

{#if portalEl}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="handle-menu"
    style="left: {posX}px; top: {posY}px; transform: {transformMap[direction]};"
    onkeydown={handleKeydown}
    onpointerdown={stopAll}
    onmousedown={stopAll}
    onclick={stopAll}
    use:portal={portalEl}
  >
    {#if handles.length > 0}
      {#each handles as h (h.handleId)}
        {@const active = pinnedIds.has(h.handleId)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
          class="menu-item"
          class:menu-item-active={active}
          onpointerdown={(e) => handleToggle(h, e)}
          role="button"
          tabindex="0"
        >
          <span class="handle-dot" class:dot-source={h.type === 'source'} class:dot-target={h.type === 'target'}></span>
          <span class="handle-label">{h.label}</span>
          <span class="handle-type">{h.type === 'source' ? 'out' : 'in'}</span>
        </div>
      {/each}
    {:else}
      <div class="menu-empty">No connection handles</div>
    {/if}

    <div class="menu-divider"></div>

    <div class="annotation-section">
      <div class="annotation-header">
        <span class="annotation-dot"></span>
        <span class="annotation-label">Annotations ({dirLabel[direction]})</span>
        <span class="annotation-count">{annotationCount}</span>
      </div>
      <div class="annotation-actions">
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
          class="menu-item annotation-action"
          onpointerdown={handleAddAnnotation}
          role="button"
          tabindex="0"
        >
          <span class="action-icon">+</span>
          <span class="handle-label">Add annotation point</span>
        </div>
        {#if annotationCount > 0}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div
            class="menu-item annotation-action annotation-remove"
            onpointerdown={handleRemoveAnnotation}
            role="button"
            tabindex="0"
          >
            <span class="action-icon">−</span>
            <span class="handle-label">Remove annotation point</span>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .handle-menu {
    position: fixed;
    background: #1a1d27;
    border: 1px solid #2e3347;
    border-radius: 6px;
    padding: 4px;
    min-width: 200px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    z-index: 9999;
    pointer-events: all;
  }

  .menu-empty {
    padding: 8px 12px;
    font-size: 12px;
    color: #6b7280;
    text-align: center;
    white-space: nowrap;
  }

  .menu-divider {
    height: 1px;
    background: #2e3347;
    margin: 4px 6px;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.1s;
    white-space: nowrap;
  }

  .menu-item:hover {
    background: #2a2d3d;
  }

  .menu-item-active {
    background: rgba(59, 130, 246, 0.12);
  }
  .menu-item-active:hover {
    background: rgba(59, 130, 246, 0.2);
  }

  .handle-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .dot-source {
    background: #22c55e;
    border: 1px solid #16a34a;
  }
  .dot-target {
    background: #3b82f6;
    border: 1px solid #2563eb;
  }

  .handle-label {
    font-size: 12.5px;
    color: #e1e4ed;
    flex: 1;
  }

  .handle-type {
    font-size: 10px;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .annotation-section {
    padding: 0;
  }

  .annotation-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px 3px;
  }

  .annotation-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #f59e0b;
    border: 1px solid #d97706;
    flex-shrink: 0;
  }

  .annotation-label {
    font-size: 10.5px;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    flex: 1;
  }

  .annotation-count {
    font-size: 10.5px;
    color: #9ca3af;
    font-weight: 600;
  }

  .action-icon {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    font-weight: 600;
    color: #9ca3af;
    flex-shrink: 0;
  }

  .annotation-remove:hover {
    background: rgba(239, 68, 68, 0.12);
  }
  .annotation-remove:hover .handle-label {
    color: #f87171;
  }
  .annotation-remove:hover .action-icon {
    color: #f87171;
  }
</style>
