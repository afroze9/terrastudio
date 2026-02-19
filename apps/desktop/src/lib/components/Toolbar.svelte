<script lang="ts">
  import { ui } from '$lib/stores/ui.svelte';
  import { diagram } from '$lib/stores/diagram.svelte';
  import { project } from '$lib/stores/project.svelte';
  import { terraform } from '$lib/stores/terraform.svelte';
  import { openProject, saveDiagram } from '$lib/services/project-service';
  import { generateAndWrite } from '$lib/services/terraform-service';

  let { onNewProject }: { onNewProject: () => void } = $props();

  const canGenerate = $derived(
    project.isOpen && diagram.nodes.length > 0 && !terraform.isRunning,
  );

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
</script>

<header class="toolbar">
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
    <button
      class="toolbar-btn toolbar-btn-accent"
      disabled={!canGenerate}
      onclick={handleGenerate}
    >
      Generate
    </button>
  </div>
</header>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    height: 44px;
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }
  .toolbar-left, .toolbar-center, .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
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
</style>
