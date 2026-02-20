<script lang="ts">
  import { NodeResizer } from '@xyflow/svelte';
  import { registry } from '$lib/bootstrap';
  import DeploymentBadge from './DeploymentBadge.svelte';
  import NodeTooltip from './NodeTooltip.svelte';
  import HandleWithLabel from './HandleWithLabel.svelte';
  import type { ContainerStyle } from '@terrastudio/types';

  let { data, id, selected }: { data: any; id: string; selected?: boolean } = $props();

  let schema = $derived(registry.getResourceSchema(data.typeId));
  let icon = $derived(schema ? registry.getIcon(data.typeId) : null);
  let handles = $derived(schema?.handles ?? []);
  let cs = $derived<ContainerStyle>(schema?.containerStyle ?? {});

  let borderColor = $derived(cs.borderColor ?? 'var(--color-border, #2e3347)');
  let borderStyle = $derived(cs.borderStyle ?? 'dashed');
  let bg = $derived(cs.backgroundColor ?? 'rgba(26, 29, 39, 0.6)');
  let headerColor = $derived(cs.headerColor ?? 'var(--color-text-muted, #8b90a0)');
  let radius = $derived(cs.borderRadius ?? 10);

  let hoverTimer: ReturnType<typeof setTimeout> | null = null;
  let showTooltip = $state(false);

  function onMouseEnter() {
    hoverTimer = setTimeout(() => { showTooltip = true; }, 300);
  }

  function onMouseLeave() {
    showTooltip = false;
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
  }
</script>

<NodeResizer minWidth={200} minHeight={120} isVisible={selected ?? false} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="container-node"
  class:selected
  style="border-color: {selected ? 'var(--color-accent, #3b82f6)' : borderColor}; border-style: {borderStyle}; background: {bg}; border-radius: {radius}px;"
  onmouseenter={onMouseEnter}
  onmouseleave={onMouseLeave}
>
  <div class="container-header" style="border-bottom-color: {borderColor};">
    {#if icon?.type === 'svg' && icon.svg}
      <span class="node-icon">{@html icon.svg}</span>
    {/if}
    <span class="node-label" style="color: {headerColor};">{data.label || schema?.displayName || 'Container'}</span>
    <DeploymentBadge status={data.deploymentStatus} />
  </div>
  <div class="container-body"></div>

  {#each handles as handle}
    <HandleWithLabel {handle} nodeTypeId={data.typeId} />
  {/each}

  {#if schema && !selected}
    <NodeTooltip
      {schema}
      terraformName={data.terraformName}
      deploymentStatus={data.deploymentStatus}
      properties={data.properties}
      visible={showTooltip}
    />
  {/if}
</div>

<style>
  .container-node {
    position: relative;
    border-width: 1.5px;
    padding: 0;
    min-width: 250px;
    min-height: 150px;
    width: 100%;
    height: 100%;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    transition: border-color 0.15s, box-shadow 0.15s;
    display: flex;
    flex-direction: column;
  }
  .container-node.selected {
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
  }
  .container-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid;
  }
  .node-icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }
  .node-icon :global(svg) {
    width: 18px;
    height: 18px;
  }
  .node-label {
    font-size: 12px;
    font-weight: 600;
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .container-body {
    flex: 1;
    min-height: 80px;
    padding: 8px;
  }
</style>
