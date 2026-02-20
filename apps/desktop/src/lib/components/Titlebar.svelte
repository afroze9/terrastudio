<script lang="ts">
  import { project } from '$lib/stores/project.svelte';
  import MenuBar from './MenuBar.svelte';
  import WindowControls from './WindowControls.svelte';

  let { onNewProject }: { onNewProject: () => void } = $props();
</script>

<header class="titlebar" data-tauri-drag-region>
  <svg class="app-icon" width="16" height="16" viewBox="0 0 512 512" data-tauri-drag-region>
    <line x1="256" y1="128" x2="128" y2="340" stroke="#60a5fa" stroke-width="20" stroke-linecap="round" opacity="0.6"/>
    <line x1="256" y1="128" x2="384" y2="340" stroke="#5eead4" stroke-width="20" stroke-linecap="round" opacity="0.6"/>
    <line x1="128" y1="340" x2="384" y2="340" stroke="#a855f7" stroke-width="20" stroke-linecap="round" opacity="0.6"/>
    <rect x="206" y="78" width="100" height="100" rx="22" fill="#3b82f6"/>
    <circle cx="128" cy="340" r="54" fill="#14b8a6"/>
    <polygon points="384,290 424,313 424,367 384,390 344,367 344,313" fill="#9333ea" stroke="#9333ea" stroke-width="14" stroke-linejoin="round"/>
  </svg>
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
  .app-icon {
    flex-shrink: 0;
    margin-right: 6px;
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
