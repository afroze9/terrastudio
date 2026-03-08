<script lang="ts">
  import type { ArrowDirection, HandleMenuEntry } from '$lib/stores/connection-ux.svelte';

  let { handles, direction, pinnedIds, onToggle, onClose }: {
    handles: HandleMenuEntry[];
    direction: ArrowDirection;
    pinnedIds: Set<string>;
    onToggle: (handle: HandleMenuEntry) => void;
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
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="handle-menu menu-{direction}"
  onkeydown={handleKeydown}
  onpointerdown={stopAll}
  onmousedown={stopAll}
  onclick={stopAll}
>
  {#if handles.length === 0}
    <div class="menu-empty">No connections available</div>
  {:else}
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
  {/if}
</div>

<style>
  .handle-menu {
    position: absolute;
    background: #1a1d27;
    border: 1px solid #2e3347;
    border-radius: 5px;
    padding: 3px;
    min-width: 140px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    z-index: 20;
    pointer-events: all;
  }

  /* Position the menu relative to the arrow direction */
  .menu-top {
    bottom: calc(100% + 16px);
    left: 50%;
    transform: translateX(-50%);
  }
  .menu-right {
    left: calc(100% + 16px);
    top: 50%;
    transform: translateY(-50%);
  }
  .menu-bottom {
    top: calc(100% + 16px);
    left: 50%;
    transform: translateX(-50%);
  }
  .menu-left {
    right: calc(100% + 16px);
    top: 50%;
    transform: translateY(-50%);
  }

  .menu-empty {
    padding: 6px 10px;
    font-size: 10px;
    color: #6b7280;
    text-align: center;
    white-space: nowrap;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border-radius: 3px;
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
    width: 6px;
    height: 6px;
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
    font-size: 10.5px;
    color: #e1e4ed;
    flex: 1;
  }

  .handle-type {
    font-size: 9px;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
</style>
