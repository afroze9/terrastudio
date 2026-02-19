<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';
  import { registry } from '$lib/bootstrap';
  import DeploymentBadge from './DeploymentBadge.svelte';

  let { data, id, selected }: { data: any; id: string; selected?: boolean } = $props();

  let schema = $derived(registry.getResourceSchema(data.typeId));
  let icon = $derived(schema ? registry.getIcon(data.typeId) : null);
  let handles = $derived(schema?.handles ?? []);
</script>

<div class="resource-node" class:selected>
  <div class="node-header">
    {#if icon?.type === 'svg' && icon.svg}
      <span class="node-icon">{@html icon.svg}</span>
    {/if}
    <span class="node-label">{data.label || schema?.displayName || 'Resource'}</span>
    <DeploymentBadge status={data.deploymentStatus} />
  </div>
  <div class="node-type">{schema?.terraformType ?? data.typeId}</div>

  {#each handles as handle}
    <Handle
      type={handle.type}
      position={handle.position === 'top' ? Position.Top : handle.position === 'bottom' ? Position.Bottom : handle.position === 'left' ? Position.Left : Position.Right}
      id={handle.id}
    />
  {/each}
</div>

<style>
  .resource-node {
    background: var(--color-surface, #1a1d27);
    border: 1.5px solid var(--color-border, #2e3347);
    border-radius: 8px;
    padding: 10px 14px;
    min-width: 160px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .resource-node.selected {
    border-color: var(--color-accent, #3b82f6);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25);
  }
  .node-header {
    display: flex;
    align-items: center;
    gap: 8px;
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
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text, #e1e4ed);
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .node-type {
    font-size: 10px;
    color: var(--color-text-muted, #8b90a0);
    margin-top: 4px;
  }
</style>
