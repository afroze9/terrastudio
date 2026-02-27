<script lang="ts">
  import { useSvelteFlow } from '@xyflow/svelte';
  import { diagram } from '$lib/stores/diagram.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import {
    alignLeft, alignCenterH, alignRight,
    alignTop, alignMiddleV, alignBottom,
    distributeHorizontal, distributeVertical,
  } from '$lib/services/alignment-service';

  const { flowToScreenPosition } = useSvelteFlow();

  let selectedNodes = $derived(diagram.nodes.filter((n) => n.selected));
  let count = $derived(selectedNodes.length);

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

  // Compute bounding box in flow coords, then convert to screen coords for positioning
  let toolbarPos = $derived.by(() => {
    if (count < 2) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;

    for (const n of selectedNodes) {
      const abs = getAbsolutePosition(n.id);
      const w = n.measured?.width ?? (n.width as number | undefined) ?? 250;
      minX = Math.min(minX, abs.x);
      minY = Math.min(minY, abs.y);
      maxX = Math.max(maxX, abs.x + w);
    }

    const centerFlowX = (minX + maxX) / 2;
    const topFlowY = minY;

    const screen = flowToScreenPosition({ x: centerFlowX, y: topFlowY });
    return { x: screen.x, y: screen.y - 44 };
  });
</script>

{#if count >= 2 && toolbarPos}
  <div
    class="selection-toolbar {ui.theme}"
    style="left: {toolbarPos.x}px; top: {toolbarPos.y}px;"
  >
    <!-- Align horizontal -->
    <div class="btn-group">
      <button class="tb-btn" title="Align left" onclick={alignLeft}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <rect x="1" y="0" width="2" height="16" rx="0.5" />
          <rect x="5" y="2" width="8" height="4" rx="1" opacity="0.7" />
          <rect x="5" y="10" width="5" height="4" rx="1" opacity="0.7" />
        </svg>
      </button>
      <button class="tb-btn" title="Align center horizontally" onclick={alignCenterH}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <rect x="7" y="0" width="2" height="16" rx="0.5" opacity="0.4" />
          <rect x="3" y="2" width="10" height="4" rx="1" opacity="0.7" />
          <rect x="5" y="10" width="6" height="4" rx="1" opacity="0.7" />
        </svg>
      </button>
      <button class="tb-btn" title="Align right" onclick={alignRight}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <rect x="13" y="0" width="2" height="16" rx="0.5" />
          <rect x="3" y="2" width="8" height="4" rx="1" opacity="0.7" />
          <rect x="6" y="10" width="5" height="4" rx="1" opacity="0.7" />
        </svg>
      </button>
    </div>

    <div class="separator"></div>

    <!-- Align vertical -->
    <div class="btn-group">
      <button class="tb-btn" title="Align top" onclick={alignTop}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <rect x="0" y="1" width="16" height="2" rx="0.5" />
          <rect x="2" y="5" width="4" height="8" rx="1" opacity="0.7" />
          <rect x="10" y="5" width="4" height="5" rx="1" opacity="0.7" />
        </svg>
      </button>
      <button class="tb-btn" title="Align middle vertically" onclick={alignMiddleV}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <rect x="0" y="7" width="16" height="2" rx="0.5" opacity="0.4" />
          <rect x="2" y="2" width="4" height="12" rx="1" opacity="0.7" />
          <rect x="10" y="4" width="4" height="8" rx="1" opacity="0.7" />
        </svg>
      </button>
      <button class="tb-btn" title="Align bottom" onclick={alignBottom}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <rect x="0" y="13" width="16" height="2" rx="0.5" />
          <rect x="2" y="3" width="4" height="8" rx="1" opacity="0.7" />
          <rect x="10" y="6" width="4" height="5" rx="1" opacity="0.7" />
        </svg>
      </button>
    </div>

    <div class="separator"></div>

    <!-- Distribute -->
    <div class="btn-group">
      <button class="tb-btn" title="Distribute horizontally" onclick={distributeHorizontal} disabled={count < 3}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <rect x="0" y="0" width="1.5" height="16" rx="0.5" opacity="0.4" />
          <rect x="14.5" y="0" width="1.5" height="16" rx="0.5" opacity="0.4" />
          <rect x="3" y="3" width="4" height="10" rx="1" opacity="0.7" />
          <rect x="9" y="3" width="4" height="10" rx="1" opacity="0.7" />
        </svg>
      </button>
      <button class="tb-btn" title="Distribute vertically" onclick={distributeVertical} disabled={count < 3}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <rect x="0" y="0" width="16" height="1.5" rx="0.5" opacity="0.4" />
          <rect x="0" y="14.5" width="16" height="1.5" rx="0.5" opacity="0.4" />
          <rect x="3" y="3" width="10" height="4" rx="1" opacity="0.7" />
          <rect x="3" y="9" width="10" height="4" rx="1" opacity="0.7" />
        </svg>
      </button>
    </div>
  </div>
{/if}

<style>
  .selection-toolbar {
    position: fixed;
    transform: translateX(-50%);
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 3px;
    border-radius: 6px;
    pointer-events: auto;
  }
  .selection-toolbar.dark {
    background: #2a2d3a;
    border: 1px solid #454860;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
  }
  .selection-toolbar.light {
    background: #ffffff;
    border: 1px solid #d1d5db;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  }
  .btn-group {
    display: flex;
    gap: 1px;
  }
  .separator {
    width: 1px;
    height: 18px;
    margin: 0 2px;
  }
  .dark .separator { background: #454860; }
  .light .separator { background: #d1d5db; }

  .tb-btn {
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.1s, color 0.1s;
  }
  .dark .tb-btn { color: #a0a4b8; }
  .light .tb-btn { color: #6b7280; }

  .dark .tb-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: #e0e4f0;
  }
  .light .tb-btn:hover:not(:disabled) {
    background: rgba(0, 0, 0, 0.06);
    color: #1f2937;
  }
  .tb-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }
</style>
