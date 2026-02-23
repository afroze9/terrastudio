<script lang="ts">
  import { ui } from '$lib/stores/ui.svelte';
  import { project } from '$lib/stores/project.svelte';

  let contextMenu = $state<{ tabId: string; x: number; y: number } | null>(null);

  function openContextMenu(e: MouseEvent, tabId: string) {
    e.preventDefault();
    e.stopPropagation();
    contextMenu = { tabId, x: e.clientX, y: e.clientY };
  }

  function closeContextMenu() {
    contextMenu = null;
  }

  function handleClose(tabId: string) {
    ui.closeTab(tabId);
    closeContextMenu();
  }

  function handleCloseOthers(tabId: string) {
    ui.closeOtherTabs(tabId);
    closeContextMenu();
  }

  // Count non-canvas tabs to know if "Close Others" makes sense
  let nonCanvasTabs = $derived(ui.tabs.filter((t) => t.id !== 'canvas'));
</script>

<svelte:window onclick={closeContextMenu} />

<div class="tab-bar">
  {#each ui.tabs as tab (tab.id)}
    <button
      class="tab"
      class:active={ui.activeTabId === tab.id}
      onclick={() => (ui.activeTabId = tab.id)}
      oncontextmenu={(e) => openContextMenu(e, tab.id)}
    >
      {#if tab.type === 'canvas'}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
      {:else}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      {/if}
      <span class="tab-label">{tab.label}</span>
      {#if tab.type === 'canvas' && project.isDirty}
        <span class="dirty-dot"></span>
      {/if}
      {#if tab.type !== 'canvas'}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <span
          class="tab-close"
          role="button"
          tabindex="-1"
          onclick={(e) => {
            e.stopPropagation();
            ui.closeTab(tab.id);
          }}
          aria-label="Close tab"
        >&times;</span>
      {/if}
    </button>
  {/each}
  <div class="tab-spacer"></div>
  <button
    class="toggle-props-btn"
    class:active={ui.showPropertiesPanel}
    onclick={() => (ui.showPropertiesPanel = !ui.showPropertiesPanel)}
    title={ui.showPropertiesPanel ? 'Hide Properties Panel' : 'Show Properties Panel'}
    aria-label="Toggle properties panel"
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="14" y="3" width="7" height="18" rx="1"/>
      <rect x="3" y="3" width="7" height="18" rx="1" opacity="0.3"/>
    </svg>
  </button>
</div>

<!-- Context menu -->
{#if contextMenu}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="tab-context-menu"
    style="left: {contextMenu.x}px; top: {contextMenu.y}px;"
    onclick={(e) => e.stopPropagation()}
    oncontextmenu={(e) => e.stopPropagation()}
  >
    {#if contextMenu.tabId !== 'canvas'}
      <button class="ctx-item" onclick={() => handleClose(contextMenu!.tabId)}>
        Close
      </button>
    {/if}
    <button
      class="ctx-item"
      disabled={nonCanvasTabs.length <= 1 && contextMenu.tabId === nonCanvasTabs[0]?.id}
      onclick={() => handleCloseOthers(contextMenu!.tabId)}
    >
      Close Others
    </button>
  </div>
{/if}

<style>
  .tab-bar {
    display: flex;
    align-items: stretch;
    height: 35px;
    background: var(--color-bg);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
    overflow-x: auto;
    overflow-y: hidden;
  }
  .tab-bar::-webkit-scrollbar {
    height: 0;
  }
  .tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 12px;
    width: 160px;
    min-width: 160px;
    border: none;
    border-top: 2px solid transparent;
    border-right: 1px solid var(--color-border);
    background: var(--color-bg);
    color: var(--color-text-muted);
    font-size: 12px;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: background 0.1s;
  }
  .tab:hover {
    background: var(--color-surface-hover);
  }
  .tab.active {
    background: var(--color-surface);
    color: var(--color-text);
    border-top-color: var(--color-accent);
  }
  .tab svg {
    flex-shrink: 0;
    opacity: 0.6;
  }
  .tab.active svg {
    opacity: 1;
  }
  .tab-label {
    pointer-events: none;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: left;
  }
  .dirty-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-accent);
    flex-shrink: 0;
  }
  .tab-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-muted);
    font-size: 14px;
    cursor: pointer;
    padding: 2px;
    line-height: 1;
    border-radius: 3px;
    flex-shrink: 0;
    opacity: 0.4;
    transition: opacity 0.1s, background 0.1s;
  }
  .tab:hover .tab-close {
    opacity: 0.7;
  }
  .tab-close:hover {
    opacity: 1;
    background: var(--color-surface-hover);
    color: var(--color-text);
  }
  .tab-spacer {
    flex: 1;
  }
  .toggle-props-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 35px;
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    flex-shrink: 0;
    transition: color 0.1s, background 0.1s;
  }
  .toggle-props-btn:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }
  .toggle-props-btn.active {
    color: var(--color-accent);
  }

  /* Context menu */
  .tab-context-menu {
    position: fixed;
    z-index: 9999;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    padding: 4px;
    min-width: 140px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  }
  .ctx-item {
    display: block;
    width: 100%;
    padding: 5px 10px;
    border: none;
    border-radius: 3px;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 12px;
    text-align: left;
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
  }
  .ctx-item:hover:not(:disabled) {
    background: var(--color-accent);
    color: white;
  }
  .ctx-item:disabled {
    opacity: 0.35;
    cursor: default;
  }
</style>
