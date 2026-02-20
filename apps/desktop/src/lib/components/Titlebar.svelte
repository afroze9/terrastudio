<script lang="ts">
  import { project } from '$lib/stores/project.svelte';
  import MenuBar from './MenuBar.svelte';
  import WindowControls from './WindowControls.svelte';

  let { onNewProject }: { onNewProject: () => void } = $props();
</script>

<header class="titlebar" data-tauri-drag-region>
  <span class="app-logo" data-tauri-drag-region>TerraStudio</span>
  {#if project.isOpen}
    <MenuBar {onNewProject} />
  {/if}
  <div class="drag-spacer" data-tauri-drag-region></div>
  {#if project.name}
    <span class="project-name" data-tauri-drag-region>
      {project.name}{#if project.isDirty} <span class="dirty-dot"></span>{/if}
    </span>
  {/if}
  <WindowControls />
</header>

<style>
  .titlebar {
    display: flex;
    align-items: center;
    height: 30px;
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
    -webkit-app-region: drag;
    padding-left: 12px;
    gap: 0;
  }
  .app-logo {
    font-weight: 700;
    font-size: 12px;
    letter-spacing: -0.02em;
    color: var(--color-accent);
    margin-right: 12px;
    flex-shrink: 0;
  }
  .drag-spacer {
    flex: 1;
    height: 100%;
  }
  .project-name {
    font-size: 11px;
    color: var(--color-text-muted);
    margin-right: 8px;
    flex-shrink: 0;
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
