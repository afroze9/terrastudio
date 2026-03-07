<script lang="ts">
  import { ui, type BottomPanelTab } from '$lib/stores/ui.svelte';
  import TerminalTab from './bottom-panel/TerminalTab.svelte';
  import ProblemsTab from './bottom-panel/ProblemsTab.svelte';
  import SearchTab from './bottom-panel/SearchTab.svelte';
  import AnnotationsTab from './bottom-panel/AnnotationsTab.svelte';

  let isResizing = $state(false);

  const tabs: { id: BottomPanelTab; label: string }[] = [
    { id: 'terminal', label: 'Terminal' },
    { id: 'problems', label: 'Problems' },
    { id: 'search', label: 'Search' },
    { id: 'annotations', label: 'Annotations' },
  ];

  function onResizeMouseDown(e: MouseEvent) {
    e.preventDefault();
    isResizing = true;
    const startY = e.clientY;
    const startHeight = ui.bottomPanelHeight;

    function onMouseMove(e: MouseEvent) {
      const delta = startY - e.clientY;
      const newHeight = Math.max(100, Math.min(600, startHeight + delta));
      ui.setBottomPanelHeight(newHeight);
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

{#if ui.showBottomPanel}
  <div class="bottom-panel" style="height: {ui.bottomPanelHeight}px">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="resize-handle"
      class:active={isResizing}
      onmousedown={onResizeMouseDown}
    ></div>
    <div class="panel-header">
      <div class="tab-bar">
        {#each tabs as tab (tab.id)}
          <button
            class="panel-tab"
            class:active={ui.activeBottomTab === tab.id}
            onclick={() => ui.openBottomPanel(tab.id)}
          >
            {tab.label}
          </button>
        {/each}
      </div>
      <button class="panel-btn" onclick={() => { ui.showBottomPanel = false; }}>Hide</button>
    </div>
    <div class="panel-content">
      {#if ui.activeBottomTab === 'terminal'}
        <TerminalTab />
      {:else if ui.activeBottomTab === 'problems'}
        <ProblemsTab />
      {:else if ui.activeBottomTab === 'search'}
        <SearchTab />
      {:else if ui.activeBottomTab === 'annotations'}
        <AnnotationsTab />
      {/if}
    </div>
  </div>
{/if}

<style>
  .bottom-panel {
    background: var(--color-bg);
    border-top: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex-shrink: 0;
    position: relative;
  }
  .resize-handle {
    position: absolute;
    top: -2px;
    left: 0;
    right: 0;
    height: 4px;
    cursor: row-resize;
    z-index: 10;
  }
  .resize-handle:hover, .resize-handle.active {
    background: var(--color-accent);
    opacity: 0.5;
  }
  .panel-header {
    display: flex;
    align-items: center;
    padding: 0 12px 0 0;
    height: 30px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--color-border);
    gap: 0;
  }
  .tab-bar {
    display: flex;
    align-items: stretch;
    height: 100%;
    flex: 1;
    gap: 0;
  }
  .panel-tab {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--color-text-muted);
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    cursor: pointer;
    padding: 0 12px;
    height: 100%;
    display: flex;
    align-items: center;
    transition: color 0.1s;
  }
  .panel-tab:hover {
    color: var(--color-text);
  }
  .panel-tab.active {
    color: var(--color-text);
    border-bottom-color: var(--color-accent);
  }
  .panel-btn {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 10px;
    cursor: pointer;
    padding: 2px 6px;
  }
  .panel-btn:hover {
    color: var(--color-text);
  }
  .panel-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    min-height: 0;
  }
</style>
