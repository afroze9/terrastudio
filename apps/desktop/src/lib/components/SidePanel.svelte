<script lang="ts">
  import { ui } from '$lib/stores/ui.svelte';
  import { registry } from '$lib/bootstrap';
  import ResourcePalette from './ResourcePalette.svelte';
  import TerraformSidebar from './TerraformSidebar.svelte';
  import ProjectConfigPanel from './ProjectConfigPanel.svelte';

  const categoryIds = registry.getPaletteCategories().map((c) => c.id);

  const allCollapsed = $derived(categoryIds.every((id) => ui.isCategoryCollapsed(id)));

  const viewTitle = $derived.by(() => {
    switch (ui.activeView) {
      case 'explorer': return 'RESOURCES';
      case 'terraform': return 'TERRAFORM';
      case 'settings': return 'PROJECT';
      default: return '';
    }
  });

  let isResizing = $state(false);

  function onMouseDown(e: MouseEvent) {
    e.preventDefault();
    isResizing = true;
    const startX = e.clientX;
    const startWidth = ui.sidePanelWidth;

    function onMouseMove(e: MouseEvent) {
      const delta = e.clientX - startX;
      const newWidth = Math.max(200, Math.min(500, startWidth + delta));
      ui.sidePanelWidth = newWidth;
    }

    function onMouseUp() {
      isResizing = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }
</script>

<aside class="side-panel" style="width: {ui.sidePanelWidth}px">
  <div class="panel-header">
    <span class="panel-title">{viewTitle}</span>
    <div class="header-spacer"></div>
    {#if ui.activeView === 'explorer'}
      <button
        class="header-action"
        onclick={() => ui.toggleAllCategories(categoryIds)}
        title={allCollapsed ? 'Expand All' : 'Collapse All'}
        aria-label={allCollapsed ? 'Expand all categories' : 'Collapse all categories'}
      >
        {#if allCollapsed}
          <!-- ^ v  — chevrons pointing apart (expand) -->
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="4 6 8 2 12 6"/>
            <polyline points="4 10 8 14 12 10"/>
          </svg>
        {:else}
          <!-- v ^  — chevrons pointing together (collapse) -->
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="4 2 8 6 12 2"/>
            <polyline points="4 14 8 10 12 14"/>
          </svg>
        {/if}
      </button>
    {/if}
  </div>
  <div class="panel-content">
    {#if ui.activeView === 'explorer'}
      <ResourcePalette />
    {:else if ui.activeView === 'terraform'}
      <TerraformSidebar />
    {:else if ui.activeView === 'settings'}
      <ProjectConfigPanel />
    {/if}
  </div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="resize-handle"
    class:active={isResizing}
    onmousedown={onMouseDown}
  ></div>
</aside>

<style>
  .side-panel {
    min-width: 200px;
    max-width: 500px;
    background: var(--color-surface);
    border-right: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    position: relative;
    overflow: hidden;
  }
  .panel-header {
    display: flex;
    align-items: center;
    padding: 0 12px;
    height: 35px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--color-border);
  }
  .panel-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
  }
  .header-spacer {
    flex: 1;
  }
  .header-action {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    opacity: 0.5;
    transition: opacity 0.1s, background 0.1s;
  }
  .header-action:hover {
    opacity: 1;
    background: var(--color-surface-hover);
  }
  .panel-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }
  .resize-handle {
    position: absolute;
    top: 0;
    right: -2px;
    width: 4px;
    height: 100%;
    cursor: col-resize;
    z-index: 10;
  }
  .resize-handle:hover, .resize-handle.active {
    background: var(--color-accent);
    opacity: 0.5;
  }
</style>
