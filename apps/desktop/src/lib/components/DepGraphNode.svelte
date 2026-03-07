<script lang="ts">
  import { registry } from '$lib/bootstrap';
  import { depGraph } from '$lib/stores/dep-graph.svelte';
  import { CATEGORY_COLORS } from '$lib/services/dep-graph-layout';
  import type { DepGraphNodeData } from '$lib/services/dep-graph-layout';
  import type { ResourceTypeId } from '@terrastudio/types';

  let { data }: { data: DepGraphNodeData } = $props();

  let iconDef = $derived(registry.getIcon(data.typeId as ResourceTypeId));
  let iconSvg = $derived(iconDef?.svg ?? '');
  let accentColor = $derived(CATEGORY_COLORS[data.category] ?? '#6b7280');

  let borderColor = $derived.by(() => {
    switch (data.highlight) {
      case 'focused': return 'var(--color-accent)';
      case 'upstream': return '#22c55e';
      case 'downstream': return '#f59e0b';
      default: return 'var(--color-border)';
    }
  });

  let opacity = $derived(data.highlight === 'unrelated' ? 0.25 : 1);

  function handleClick() {
    depGraph.setFocus(data.instanceId);
  }

  function handleDblClick() {
    depGraph.navigateToCanvas(data.instanceId);
  }
</script>

<div
  class="dep-node"
  style="border-color: {borderColor}; opacity: {opacity};"
  onclick={handleClick}
  ondblclick={handleDblClick}
  role="button"
  tabindex="0"
  aria-label="{data.label} ({data.terraformAddress})"
  title="{data.displayName}\n{data.terraformAddress}"
>
  <div class="accent-bar" style="background: {accentColor};"></div>
  <div class="node-icon">
    {#if iconSvg}
      {@html iconSvg}
    {:else}
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    {/if}
  </div>
  <div class="node-text">
    <div class="node-label">{data.label}</div>
    <div class="node-address">{data.terraformAddress}</div>
  </div>
</div>

<style>
  .dep-node {
    display: flex;
    align-items: center;
    width: 220px;
    height: 64px;
    background: var(--color-surface);
    border: 1.5px solid var(--color-border);
    border-radius: 6px;
    overflow: hidden;
    cursor: pointer;
    transition: border-color 0.15s, opacity 0.15s;
  }

  .dep-node:hover {
    border-color: var(--color-accent) !important;
  }

  .accent-bar {
    width: 4px;
    height: 100%;
    flex-shrink: 0;
  }

  .node-icon {
    width: 28px;
    height: 28px;
    margin: 0 8px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-muted);
  }

  .node-icon :global(svg) {
    width: 20px;
    height: 20px;
  }

  .node-text {
    flex: 1;
    min-width: 0;
    padding-right: 8px;
  }

  .node-label {
    font-size: var(--font-12);
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 500;
  }

  .node-address {
    font-size: var(--font-9);
    color: var(--color-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: monospace;
  }
</style>
