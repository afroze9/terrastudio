<script lang="ts">
  import { ui } from '$lib/stores/ui.svelte';
  import { diagram } from '$lib/stores/diagram.svelte';
  import PropertiesPanel from './PropertiesPanel.svelte';
  import NodeFormatPanel from './NodeFormatPanel.svelte';
  import RightActivityBar from './RightActivityBar.svelte';
</script>

<div class="right-panel-wrapper">
  <div class="right-panel-content">
    {#if ui.activeRightView === 'properties'}
      <PropertiesPanel />
    {:else if ui.activeRightView === 'formatting'}
      <div class="format-panel-standalone">
        <div class="format-panel-header">
          <h3>Visual Style</h3>
        </div>
        <div class="format-panel-body">
          {#if diagram.selectedNode}
            <NodeFormatPanel nodeId={diagram.selectedNode.id} />
          {:else}
            <div class="empty-state">
              Select a node to customize its visual style
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
  <RightActivityBar />
</div>

<style>
  .right-panel-wrapper {
    display: flex;
    height: 100%;
  }
  .right-panel-content {
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }
  .format-panel-standalone {
    width: 300px;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--color-surface);
    border-left: 1px solid var(--color-border);
  }
  .format-panel-header {
    display: flex;
    align-items: center;
    padding: 10px 12px;
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }
  .format-panel-header h3 {
    font-size: var(--font-11);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
    margin: 0;
  }
  .format-panel-body {
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
