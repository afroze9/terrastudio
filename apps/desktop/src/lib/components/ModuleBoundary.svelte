<script lang="ts">
  import type { ModuleDefinition } from '@terrastudio/types';
  import { diagram, type DiagramNode } from '$lib/stores/diagram.svelte';

  let {
    module,
    onselect,
    ontogglecollapse,
  }: {
    module: ModuleDefinition;
    onselect: (moduleId: string) => void;
    ontogglecollapse: (moduleId: string) => void;
  } = $props();

  const PADDING = 24;

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
</script>

{#if bounds}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="module-boundary"
    class:selected={isSelected}
    style:left="{bounds.x}px"
    style:top="{bounds.y}px"
    style:width="{bounds.width}px"
    style:height="{bounds.height}px"
    style:--module-color={borderColor}
    onclick={(e) => { e.stopPropagation(); onselect(module.id); }}
  >
    <div class="module-header">
      <button
        class="collapse-btn"
        title="Collapse module"
        onclick={(e) => { e.stopPropagation(); ontogglecollapse(module.id); }}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      <span class="module-name">{module.name}</span>
      <span class="module-badge">{memberCount}</span>
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
    cursor: pointer;
    border-radius: 6px 6px 0 0;
    background: var(--module-color);
    opacity: 0.9;
    z-index: 1001;
  }

  .module-name {
    font-size: 12px;
    font-weight: 600;
    color: white;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    user-select: none;
  }

  .module-badge {
    font-size: 10px;
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
</style>
