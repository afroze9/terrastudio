<script lang="ts">
  import { ui } from '$lib/stores/ui.svelte';
  import { diagram } from '$lib/stores/diagram.svelte';
  import { project } from '$lib/stores/project.svelte';
  import { openProject, saveDiagram } from '$lib/services/project-service';
  import { exportPNG, copyDiagramToClipboard, exportDocumentation } from '$lib/services/export-service';

  let { onNewProject }: { onNewProject: () => void } = $props();

  let openMenu = $state<string | null>(null);

  const canExport = $derived(project.isOpen && diagram.nodes.length > 0);

  function toggle(menu: string) {
    openMenu = openMenu === menu ? null : menu;
  }

  function close() {
    openMenu = null;
  }

  async function handleSave() {
    close();
    if (project.isOpen) await saveDiagram();
  }

  async function handleOpen() {
    close();
    try { await openProject(); } catch { /* cancelled */ }
  }

  function handleClose() {
    close();
    diagram.clear();
    project.close();
  }

  function handleWindowClick(e: MouseEvent) {
    if (openMenu) {
      const target = e.target as HTMLElement;
      if (!target.closest('.menu-bar')) {
        close();
      }
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<svelte:window onclick={handleWindowClick} />

<nav class="menu-bar">
  <!-- File -->
  <div class="menu-item">
    <button
      class="menu-trigger"
      class:open={openMenu === 'file'}
      onclick={() => toggle('file')}
      onmouseenter={() => { if (openMenu) openMenu = 'file'; }}
    >File</button>
    {#if openMenu === 'file'}
      <div class="dropdown">
        <button class="dropdown-item" onclick={() => { close(); onNewProject(); }}>
          <span>New Project</span>
        </button>
        <button class="dropdown-item" onclick={handleOpen}>
          <span>Open Project</span>
        </button>
        {#if project.isOpen}
          <button class="dropdown-item" onclick={handleSave}>
            <span>Save</span>
            <span class="shortcut">Ctrl+S</span>
          </button>
          <button class="dropdown-item" onclick={handleClose}>
            <span>Close Project</span>
          </button>
        {/if}
        {#if canExport}
          <div class="dropdown-separator"></div>
          <button class="dropdown-item" onclick={() => { close(); exportPNG(); }}>
            <span>Export as PNG</span>
          </button>
          <button class="dropdown-item" onclick={() => { close(); copyDiagramToClipboard(); }}>
            <span>Copy to Clipboard</span>
          </button>
          <button class="dropdown-item" onclick={() => { close(); exportDocumentation(); }}>
            <span>Export Docs (.md)</span>
          </button>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Edit -->
  <div class="menu-item">
    <button
      class="menu-trigger"
      class:open={openMenu === 'edit'}
      onclick={() => toggle('edit')}
      onmouseenter={() => { if (openMenu) openMenu = 'edit'; }}
    >Edit</button>
    {#if openMenu === 'edit'}
      <div class="dropdown">
        <button class="dropdown-item" disabled={!diagram.canUndo} onclick={() => { close(); diagram.undo(); }}>
          <span>Undo</span>
          <span class="shortcut">Ctrl+Z</span>
        </button>
        <button class="dropdown-item" disabled={!diagram.canRedo} onclick={() => { close(); diagram.redo(); }}>
          <span>Redo</span>
          <span class="shortcut">Ctrl+Y</span>
        </button>
        <div class="dropdown-separator"></div>
        <button class="dropdown-item" onclick={() => { close(); diagram.selectAll(); }}>
          <span>Select All</span>
          <span class="shortcut">Ctrl+A</span>
        </button>
      </div>
    {/if}
  </div>

  <!-- View -->
  <div class="menu-item">
    <button
      class="menu-trigger"
      class:open={openMenu === 'view'}
      onclick={() => toggle('view')}
      onmouseenter={() => { if (openMenu) openMenu = 'view'; }}
    >View</button>
    {#if openMenu === 'view'}
      <div class="dropdown">
        <button class="dropdown-item" onclick={() => { close(); ui.showSidePanel = !ui.showSidePanel; }}>
          <span>{ui.showSidePanel ? 'Hide' : 'Show'} Side Panel</span>
          <span class="shortcut">Ctrl+B</span>
        </button>
        <button class="dropdown-item" onclick={() => { close(); ui.showPropertiesPanel = !ui.showPropertiesPanel; }}>
          <span>{ui.showPropertiesPanel ? 'Hide' : 'Show'} Properties</span>
        </button>
        <button class="dropdown-item" onclick={() => { close(); ui.toggleTerminal(); }}>
          <span>{ui.showTerminal ? 'Hide' : 'Show'} Terminal</span>
          <span class="shortcut">Ctrl+J</span>
        </button>
        <div class="dropdown-separator"></div>
        <button class="dropdown-item" onclick={() => { close(); ui.setActiveView('explorer'); }}>
          <span>Resources</span>
        </button>
        <button class="dropdown-item" onclick={() => { close(); ui.setActiveView('terraform'); }}>
          <span>Terraform</span>
        </button>
        <button class="dropdown-item" onclick={() => { close(); ui.setActiveView('settings'); }}>
          <span>Project</span>
        </button>
      </div>
    {/if}
  </div>
</nav>

<style>
  .menu-bar {
    display: flex;
    align-items: stretch;
    height: 100%;
    -webkit-app-region: no-drag;
  }
  .menu-item {
    position: relative;
  }
  .menu-trigger {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 12px;
    cursor: pointer;
    padding: 0 8px;
    height: 100%;
    transition: background 0.1s, color 0.1s;
  }
  .menu-trigger:hover, .menu-trigger.open {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }
  .dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    min-width: 200px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    padding: 4px;
    z-index: 1000;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  }
  .dropdown-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 5px 10px;
    border: none;
    border-radius: 3px;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 12px;
    cursor: pointer;
    text-align: left;
  }
  .dropdown-item:hover:not(:disabled) {
    background: var(--color-accent);
    color: white;
  }
  .dropdown-item:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .shortcut {
    font-size: 11px;
    opacity: 0.6;
    margin-left: 24px;
  }
  .dropdown-item:hover .shortcut {
    opacity: 0.8;
  }
  .dropdown-separator {
    height: 1px;
    background: var(--color-border);
    margin: 4px 0;
  }
</style>
