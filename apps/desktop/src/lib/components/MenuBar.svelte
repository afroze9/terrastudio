<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { ui } from '$lib/stores/ui.svelte';
  import { diagram } from '$lib/stores/diagram.svelte';
  import { project } from '$lib/stores/project.svelte';
  import { registry } from '$lib/bootstrap';
  import { openProject, saveDiagram, guardUnsavedChanges } from '$lib/services/project-service';
  import { exportPNG, exportSVG, copyDiagramToClipboard, exportDocumentation } from '$lib/services/export-service';
  import { autoLayout, type LayoutDirection } from '$lib/services/layout-service';
  import ShortcutsModal from './ShortcutsModal.svelte';
  import AboutModal from './AboutModal.svelte';
  import SaveTemplateDialog from './SaveTemplateDialog.svelte';

  import type { EdgeStyle } from '$lib/stores/ui.svelte';
  import { getAllPalettes } from '$lib/themes/theme-engine';
  import type { PaletteId } from '$lib/themes/types';

  let showLayoutSub = $state(false);
  let showEdgeStyleSub = $state(false);
  let showPaletteSub = $state(false);
  let showShortcutsModal = $state(false);
  let showAboutModal = $state(false);
  let showSaveTemplateDialog = $state(false);

  function handleAutoLayout(direction: LayoutDirection) {
    close();
    autoLayout(registry, direction);
    ui.fitView?.();
  }

  let { onNewProject }: { onNewProject: () => void } = $props();

  let openMenu = $state<string | null>(null);

  const canExport = $derived(project.isOpen && diagram.nodes.length > 0);

  function toggle(menu: string) {
    openMenu = openMenu === menu ? null : menu;
  }

  function close() {
    openMenu = null;
    showLayoutSub = false;
    showEdgeStyleSub = false;
    showPaletteSub = false;
  }

  async function handleSave() {
    close();
    if (project.isOpen) await saveDiagram();
  }

  async function handleOpen() {
    close();
    try { await openProject(); } catch { /* cancelled */ }
  }

  async function handleClose() {
    close();
    if (!(await guardUnsavedChanges())) return;
    diagram.clear();
    project.close();
    import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
      getCurrentWindow().setTitle('TerraStudio').catch(() => {});
    });
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
          <span class="shortcut">Ctrl+N</span>
        </button>
        <button class="dropdown-item" onclick={() => { close(); invoke('create_project_window', {}); }}>
          <span>New Window</span>
          <span class="shortcut">Ctrl+⇧N</span>
        </button>
        <button class="dropdown-item" onclick={handleOpen}>
          <span>Open Project</span>
          <span class="shortcut">Ctrl+O</span>
        </button>
        {#if project.isOpen}
          <button class="dropdown-item" onclick={handleSave}>
            <span>Save</span>
            <span class="shortcut">Ctrl+S</span>
          </button>
          <button class="dropdown-item" onclick={handleClose}>
            <span>Close Project</span>
            <span class="shortcut">Ctrl+⇧W</span>
          </button>
        {/if}
        {#if canExport}
          <div class="dropdown-separator"></div>
          <button class="dropdown-item" onclick={() => { close(); exportPNG(); }}>
            <span>Export as PNG</span>
          </button>
          <button class="dropdown-item" onclick={() => { close(); exportSVG(); }}>
            <span>Export as SVG</span>
          </button>
          <button class="dropdown-item" onclick={() => { close(); copyDiagramToClipboard(); }}>
            <span>Copy to Clipboard</span>
          </button>
          <button class="dropdown-item" onclick={() => { close(); exportDocumentation(); }}>
            <span>Export Docs (.md)</span>
          </button>
          <div class="dropdown-separator"></div>
          <button class="dropdown-item" onclick={() => { close(); showSaveTemplateDialog = true; }}>
            <span>Save as Template...</span>
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
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="dropdown-item submenu-trigger"
          class:disabled={diagram.nodes.length === 0}
          onmouseenter={() => { showLayoutSub = true; }}
          onmouseleave={() => { showLayoutSub = false; }}
        >
          <span>Auto Layout</span>
          <span class="submenu-arrow">&#9656;</span>
          {#if showLayoutSub && diagram.nodes.length > 0}
            <div class="submenu">
              <button class="dropdown-item" onclick={() => handleAutoLayout('TB')}>
                <span>Top to Bottom</span>
              </button>
              <button class="dropdown-item" onclick={() => handleAutoLayout('LR')}>
                <span>Left to Right</span>
              </button>
              <button class="dropdown-item" onclick={() => handleAutoLayout('BT')}>
                <span>Bottom to Top</span>
              </button>
              <button class="dropdown-item" onclick={() => handleAutoLayout('RL')}>
                <span>Right to Left</span>
              </button>
            </div>
          {/if}
        </div>
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
          <span class="shortcut">Ctrl+`</span>
        </button>
        {#if project.isOpen}
          <button class="dropdown-item" onclick={() => { close(); ui.fitView?.(); }}>
            <span>Fit View</span>
            <span class="shortcut">Ctrl+0</span>
          </button>
        {/if}
        <div class="dropdown-separator"></div>
        <button class="dropdown-item" onclick={() => { close(); ui.toggleTheme(); }}>
          <span>{ui.theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="dropdown-item submenu-trigger"
          onmouseenter={() => { showPaletteSub = true; }}
          onmouseleave={() => { showPaletteSub = false; }}
        >
          <span>Color Palette</span>
          <span class="submenu-arrow">&#9656;</span>
          {#if showPaletteSub}
            <div class="submenu">
              {#each getAllPalettes() as palette (palette.id)}
                <button class="dropdown-item" onclick={() => { close(); ui.setPalette(palette.id as PaletteId); }}>
                  <span class="palette-indicator" style="background: {palette.previewAccent}"></span>
                  <span>{palette.name}</span>
                  {#if ui.paletteId === palette.id}
                    <span class="check-mark">&#10003;</span>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="dropdown-item submenu-trigger"
          onmouseenter={() => { showEdgeStyleSub = true; }}
          onmouseleave={() => { showEdgeStyleSub = false; }}
        >
          <span>Edge Style</span>
          <span class="submenu-arrow">&#9656;</span>
          {#if showEdgeStyleSub}
            <div class="submenu">
              {#each [
                { value: 'default', label: 'Bezier' },
                { value: 'smoothstep', label: 'Smooth Step' },
                { value: 'step', label: 'Step' },
                { value: 'straight', label: 'Straight' },
              ] as option (option.value)}
                <button class="dropdown-item" onclick={() => { close(); ui.edgeType = option.value as EdgeStyle; }}>
                  <span>{option.label}</span>
                  {#if ui.edgeType === option.value}
                    <span class="check-mark">&#10003;</span>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>
        <div class="dropdown-separator"></div>
        <button class="dropdown-item" onclick={() => { close(); ui.setActiveView('explorer'); }}>
          <span>Resources</span>
          <span class="shortcut">Alt+1</span>
        </button>
        <button class="dropdown-item" onclick={() => { close(); ui.setActiveView('terraform'); }}>
          <span>Terraform</span>
          <span class="shortcut">Alt+2</span>
        </button>
        <button class="dropdown-item" onclick={() => { close(); ui.setActiveView('settings'); }}>
          <span>Project</span>
          <span class="shortcut">Alt+3</span>
        </button>
        <div class="dropdown-separator"></div>
        <button class="dropdown-item" onclick={() => { close(); ui.setActiveView('app-settings'); }}>
          <span>Settings</span>
          <span class="shortcut">Ctrl+,</span>
        </button>
      </div>
    {/if}
  </div>

  <!-- Help -->
  <div class="menu-item">
    <button
      class="menu-trigger"
      class:open={openMenu === 'help'}
      onclick={() => toggle('help')}
      onmouseenter={() => { if (openMenu) openMenu = 'help'; }}
    >Help</button>
    {#if openMenu === 'help'}
      <div class="dropdown">
        <button class="dropdown-item" onclick={() => { close(); showShortcutsModal = true; }}>
          <span>Keyboard Shortcuts</span>
          <span class="shortcut">?</span>
        </button>
        <div class="dropdown-separator"></div>
        <button class="dropdown-item" onclick={() => { close(); showAboutModal = true; }}>
          <span>About TerraStudio</span>
        </button>
      </div>
    {/if}
  </div>
</nav>

<ShortcutsModal open={showShortcutsModal} onclose={() => (showShortcutsModal = false)} />
<AboutModal open={showAboutModal} onclose={() => (showAboutModal = false)} />
<SaveTemplateDialog
  open={showSaveTemplateDialog}
  onclose={() => (showSaveTemplateDialog = false)}
/>

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
  .check-mark {
    font-size: 12px;
    color: var(--color-accent);
    margin-left: 12px;
  }
  .palette-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-right: 2px;
  }
  .dropdown-item:hover .check-mark {
    color: white;
  }
  .submenu-trigger {
    position: relative;
  }
  .submenu-trigger.disabled {
    opacity: 0.4;
    cursor: default;
    pointer-events: none;
  }
  .submenu-arrow {
    font-size: 10px;
    opacity: 0.6;
    margin-left: 24px;
  }
  .submenu {
    position: absolute;
    left: 100%;
    top: -4px;
    min-width: 170px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    padding: 4px;
    z-index: 1001;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  }
</style>
