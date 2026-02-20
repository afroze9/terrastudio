<script lang="ts">
  import { ui } from '$lib/stores/ui.svelte';
  import { diagram } from '$lib/stores/diagram.svelte';
  import { project } from '$lib/stores/project.svelte';
  import { terraform } from '$lib/stores/terraform.svelte';
  import { openProject, saveDiagram } from '$lib/services/project-service';
  import { generateAndWrite } from '$lib/services/terraform-service';
  import { exportPNG, copyDiagramToClipboard, exportDocumentation } from '$lib/services/export-service';
  import WindowControls from './WindowControls.svelte';

  let { onNewProject }: { onNewProject: () => void } = $props();

  const canGenerate = $derived(
    project.isOpen && diagram.nodes.length > 0 && !terraform.isRunning,
  );

  const canExport = $derived(project.isOpen && diagram.nodes.length > 0);

  let showExportMenu = $state(false);

  async function handleGenerate() {
    terraform.clearOutput();
    try {
      await generateAndWrite();
      ui.showTerraformPanel = true;
    } catch {
      // Error already logged to terraform store
    }
  }

  async function handleSave() {
    if (!project.isOpen) return;
    await saveDiagram();
  }

  async function handleOpen() {
    try {
      await openProject();
    } catch {
      // User cancelled or error
    }
  }

  function handleClose() {
    diagram.clear();
    project.close();
  }

  function handleWindowClick(e: MouseEvent) {
    if (showExportMenu) {
      const target = e.target as HTMLElement;
      if (!target.closest('.export-dropdown')) {
        showExportMenu = false;
      }
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<svelte:window onclick={handleWindowClick} />

<header class="toolbar" data-tauri-drag-region>
  <div class="toolbar-left">
    <span class="app-logo">TerraStudio</span>
    <span class="separator"></span>
    <button class="toolbar-btn" onclick={onNewProject}>New</button>
    <button class="toolbar-btn" onclick={handleOpen}>Open</button>
    {#if project.isOpen}
      <button class="toolbar-btn" class:unsaved={project.isDirty} onclick={handleSave}>Save{#if project.isDirty}*{/if}</button>
      <button class="toolbar-btn" onclick={handleClose}>Close</button>
    {/if}
    {#if project.name}
      <span class="project-name">{project.name}{#if project.isDirty} <span class="dirty-dot"></span>{/if}</span>
    {/if}
  </div>
  <div class="toolbar-center">
    <button
      class="toolbar-btn"
      class:active={ui.showPalette}
      onclick={() => (ui.showPalette = !ui.showPalette)}
    >
      Palette
    </button>
    <button
      class="toolbar-btn"
      class:active={ui.showSidebar}
      onclick={() => (ui.showSidebar = !ui.showSidebar)}
    >
      Properties
    </button>
    <button
      class="toolbar-btn"
      class:active={ui.showTerraformPanel}
      onclick={() => (ui.showTerraformPanel = !ui.showTerraformPanel)}
    >
      Terraform
    </button>
  </div>
  <div class="toolbar-right">
    {#if canExport}
      <div class="export-dropdown">
        <button
          class="toolbar-btn"
          onclick={() => (showExportMenu = !showExportMenu)}
        >
          Export
        </button>
        {#if showExportMenu}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div class="export-menu" onclick={() => (showExportMenu = false)}>
            <button class="export-item" onclick={() => exportPNG()}>Save as PNG</button>
            <button class="export-item" onclick={() => copyDiagramToClipboard()}>Copy to Clipboard</button>
            <button class="export-item" onclick={() => exportDocumentation()}>Export Docs (.md)</button>
          </div>
        {/if}
      </div>
    {/if}
    <button
      class="toolbar-btn toolbar-btn-accent"
      disabled={!canGenerate}
      onclick={handleGenerate}
    >
      Generate
    </button>
    <span class="separator"></span>
    <WindowControls />
  </div>
</header>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 0 0 16px;
    height: 44px;
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
    -webkit-app-region: drag;
  }
  .toolbar-left, .toolbar-center, .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
    -webkit-app-region: no-drag;
  }
  .app-logo {
    font-weight: 700;
    font-size: 15px;
    letter-spacing: -0.02em;
    color: var(--color-accent);
  }
  .separator {
    width: 1px;
    height: 20px;
    background: var(--color-border);
    margin: 0 4px;
  }
  .project-name {
    font-size: 12px;
    color: var(--color-text-muted);
    padding: 2px 8px;
    background: var(--color-bg);
    border-radius: 4px;
  }
  .toolbar-btn {
    padding: 4px 12px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .toolbar-btn:hover:not(:disabled) {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }
  .toolbar-btn.active {
    background: var(--color-surface-hover);
    color: var(--color-text);
    border-color: var(--color-border);
  }
  .toolbar-btn-accent {
    background: var(--color-accent);
    color: white;
    border-color: var(--color-accent);
  }
  .toolbar-btn-accent:hover:not(:disabled) {
    background: var(--color-accent-hover);
  }
  .toolbar-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .toolbar-btn.unsaved {
    color: var(--color-accent);
  }
  .dirty-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-accent);
    vertical-align: middle;
    margin-left: 2px;
  }
  .export-dropdown {
    position: relative;
  }
  .export-menu {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 4px;
    min-width: 160px;
    z-index: 100;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
  .export-item {
    display: block;
    width: 100%;
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 12px;
    text-align: left;
    cursor: pointer;
  }
  .export-item:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }
</style>
