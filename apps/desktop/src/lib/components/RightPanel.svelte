<script lang="ts">
  import { ui } from '$lib/stores/ui.svelte';
  import { diagram } from '$lib/stores/diagram.svelte';
  import PropertiesPanel from './PropertiesPanel.svelte';
  import NodeFormatPanel from './NodeFormatPanel.svelte';
</script>

{#if ui.activeRightView === 'properties'}
  <PropertiesPanel />
{:else if ui.activeRightView === 'formatting'}
  <aside class="format-panel">
    <div class="panel-header">
      <h3>Visual Style</h3>
    </div>
    <div class="panel-content">
      {#if diagram.selectedNode}
        <NodeFormatPanel nodeId={diagram.selectedNode.id} />
      {:else}
        <div class="empty-state">
          Select a node to customize its visual style
        </div>
      {/if}
    </div>
  </aside>
{/if}

<style>
  .format-panel {
    width: 300px;
    min-width: 300px;
    height: 100%;
    background: var(--color-surface);
    border-left: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    flex-shrink: 0;
  }
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    height: 35px;
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }
  .panel-header h3 {
    margin: 0;
    font-size: var(--font-11);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
  }
  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }
  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--color-text-muted);
    font-size: var(--font-12);
    text-align: center;
    padding: 24px;
  }
</style>
