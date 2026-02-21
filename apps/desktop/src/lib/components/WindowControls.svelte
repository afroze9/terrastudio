<script lang="ts">
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { project } from '$lib/stores/project.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import { saveDiagram } from '$lib/services/project-service';

  const appWindow = getCurrentWindow();

  let isMaximized = $state(false);

  appWindow.isMaximized().then((v) => (isMaximized = v));

  appWindow.onResized(async () => {
    isMaximized = await appWindow.isMaximized();
  });

  async function handleClose() {
    if (project.isOpen && project.isDirty) {
      const result = await ui.confirmUnsaved();
      if (result === 'cancel') return;
      if (result === 'save') await saveDiagram();
    }
    await appWindow.destroy();
  }
</script>

<div class="window-controls">
  <button class="win-btn" onclick={() => appWindow.minimize()} aria-label="Minimize">
    <svg width="10" height="10" viewBox="0 0 10 10">
      <line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" stroke-width="1" />
    </svg>
  </button>
  <button class="win-btn" onclick={() => appWindow.toggleMaximize()} aria-label={isMaximized ? 'Restore' : 'Maximize'}>
    {#if isMaximized}
      <svg width="10" height="10" viewBox="0 0 10 10">
        <rect x="2" y="0" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1" rx="0.5" />
        <rect x="0" y="2" width="8" height="8" fill="var(--color-surface)" stroke="currentColor" stroke-width="1" rx="0.5" />
      </svg>
    {:else}
      <svg width="10" height="10" viewBox="0 0 10 10">
        <rect x="0" y="0" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1" rx="0.5" />
      </svg>
    {/if}
  </button>
  <button class="win-btn win-btn-close" onclick={handleClose} aria-label="Close">
    <svg width="10" height="10" viewBox="0 0 10 10">
      <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" stroke-width="1.2" />
      <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" stroke-width="1.2" />
    </svg>
  </button>
</div>

<style>
  .window-controls {
    display: flex;
    align-items: center;
    -webkit-app-region: no-drag;
  }
  .win-btn {
    width: 36px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
    font-family: inherit;
  }
  .win-btn:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }
  .win-btn-close:hover {
    background: #e81123;
    color: white;
  }
</style>
