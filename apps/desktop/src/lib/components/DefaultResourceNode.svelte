<script lang="ts">
  import { Handle, Position, useUpdateNodeInternals } from '@xyflow/svelte';
  import { registry } from '$lib/bootstrap';
  import { terraform } from '$lib/stores/terraform.svelte';
  import DeploymentBadge from './DeploymentBadge.svelte';
  import NodeTooltip from './NodeTooltip.svelte';
  import HandleWithLabel from './HandleWithLabel.svelte';

  const updateNodeInternals = useUpdateNodeInternals();

  let { data, id, selected }: { data: any; id: string; selected?: boolean } = $props();

  let schema = $derived(registry.getResourceSchema(data.typeId));
  let icon = $derived(schema ? registry.getIcon(data.typeId) : null);

  // Get error message for this resource if any
  let errorMessage = $derived.by(() => {
    if (data.deploymentStatus !== 'failed') return undefined;
    // Build terraform address to look up error
    if (!schema) return undefined;
    const generator = registry.getHclGenerator(data.typeId);
    const tfType = generator?.resolveTerraformType
      ? generator.resolveTerraformType(data.properties)
      : schema.terraformType;
    const address = `${tfType}.${data.terraformName}`;
    return terraform.errorAddresses.get(address);
  });
  let staticHandles = $derived(schema?.handles ?? []);
  let dynamicOutputHandles = $derived.by(() => {
    if (!schema?.outputs) return [];
    const enabled = (data.enabledOutputs as string[]) ?? [];
    return schema.outputs
      .filter((o: { key: string }) => enabled.includes(o.key))
      .map((o: { key: string; label: string }) => ({
        id: `out-${o.key}`,
        type: 'source' as const,
        position: 'right' as const,
        label: o.label,
      }));
  });
  let handles = $derived([...staticHandles, ...dynamicOutputHandles]);

  // Compute top offsets so handles on the same side are evenly spaced
  let handleStyles = $derived.by(() => {
    const all = handles;
    const bySide = new Map<string, number[]>();
    all.forEach((h, i) => {
      const list = bySide.get(h.position) ?? [];
      list.push(i);
      bySide.set(h.position, list);
    });
    const styles: (string | undefined)[] = new Array(all.length);
    for (const [, indices] of bySide) {
      if (indices.length <= 1) continue;
      indices.forEach((idx, rank) => {
        const pct = ((rank + 1) / (indices.length + 1)) * 100;
        styles[idx] = `top: ${pct}%;`;
      });
    }
    return styles;
  });

  // When dynamic handles change, tell SvelteFlow to re-read handle positions
  // Must wait for DOM paint (tick is not enough — handles need to be in the DOM)
  $effect(() => {
    dynamicOutputHandles;
    updateNodeInternals();
  });

  let hasNsg = $derived(!!data.references?.['nsg_id']);
  let nsgIcon = $derived(hasNsg ? registry.getIcon('azurerm/networking/network_security_group' as any) : null);

  let validationErrors = $derived((data.validationErrors as { message: string; severity: string }[]) ?? []);
  let hasValidationErrors = $derived(validationErrors.length > 0);
  let validationTooltip = $derived(validationErrors.map((e) => e.message).join('\n'));

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

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="resource-node"
  class:selected
  class:has-validation-errors={hasValidationErrors}
  onmouseenter={onMouseEnter}
  onmouseleave={onMouseLeave}
>
  <div class="node-header">
    {#if icon?.type === 'svg' && icon.svg}
      <span class="node-icon">{@html icon.svg}</span>
    {/if}
    <div class="node-info">
      <span class="node-label">{data.label || schema?.displayName || 'Resource'}</span>
      <span class="node-type">{schema?.terraformType ?? data.typeId}</span>
    </div>
    {#if hasNsg && nsgIcon?.type === 'svg' && nsgIcon.svg}
      <span class="nsg-badge" title="NSG attached">{@html nsgIcon.svg}</span>
    {/if}
    {#if hasValidationErrors}
      <span class="validation-badge" title={validationTooltip}>!</span>
    {/if}
    <DeploymentBadge status={data.deploymentStatus} {errorMessage} />
  </div>

  {#each handles as handle, i (handle.id)}
    <HandleWithLabel {handle} nodeTypeId={data.typeId} style={handleStyles[i]} />
  {/each}

  <!-- Ghost handles: invisible, non-connectable anchors used by reference edges
       (showAsEdge: true). React Flow needs a null-id handle on each node to
       resolve the edge endpoints; these provide that without any visual impact. -->
  <Handle type="source" position={Position.Right} style="opacity:0;pointer-events:none;" isConnectable={false} />
  <Handle type="target" position={Position.Left}  style="opacity:0;pointer-events:none;" isConnectable={false} />

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
  .resource-node {
    position: relative;
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
  .resource-node.has-validation-errors {
    border-color: #ef4444;
    box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
  }
  .resource-node.has-validation-errors.selected {
    border-color: #ef4444;
    box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.3);
  }
  .node-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .node-icon {
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }
  .node-icon :global(svg) {
    width: 22px;
    height: 22px;
  }
  .node-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .node-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text, #e1e4ed);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .node-type {
    font-size: 10px;
    color: var(--color-text-muted, #8b90a0);
  }
  .nsg-badge {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    width: 16px;
    height: 16px;
  }
  .nsg-badge :global(svg) {
    width: 16px;
    height: 16px;
  }
  .validation-badge {
    width: 15px;
    height: 15px;
    border-radius: 50%;
    background: #ef4444;
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    cursor: help;
  }
</style>
