<script lang="ts">
  import { ui } from '$lib/stores/ui.svelte';
  import TabBar from './TabBar.svelte';
  import Canvas from './Canvas.svelte';
  import FilePreview from './FilePreview.svelte';
  import TerminalPanel from './TerminalPanel.svelte';

  const activeTab = $derived(ui.tabs.find((t) => t.id === ui.activeTabId));
</script>

<div class="editor-area">
  <TabBar />
  <div class="editor-content">
    {#if activeTab?.type === 'canvas'}
      <Canvas />
    {:else if activeTab?.type === 'file'}
      <FilePreview filename={activeTab.id} />
    {/if}
  </div>
  <TerminalPanel />
</div>

<style>
  .editor-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
  .editor-content {
    flex: 1;
    display: flex;
    min-height: 0;
    overflow: hidden;
  }
</style>
