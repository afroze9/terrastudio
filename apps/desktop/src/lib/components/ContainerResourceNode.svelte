<script lang="ts">
  import { NodeResizer, useUpdateNodeInternals } from '@xyflow/svelte';
  import { registry } from '$lib/bootstrap';
  import { diagram } from '$lib/stores/diagram.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import DeploymentBadge from './DeploymentBadge.svelte';
  import NodeTooltip from './NodeTooltip.svelte';
  import HandleWithLabel from './HandleWithLabel.svelte';
  import type { ContainerStyle } from '@terrastudio/types';

  const updateNodeInternals = useUpdateNodeInternals();

  let { data, id, selected }: { data: any; id: string; selected?: boolean } = $props();

  let schema = $derived(registry.getResourceSchema(data.typeId));
  let icon = $derived(schema ? registry.getIcon(data.typeId) : null);
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
  $effect(() => {
    dynamicOutputHandles;
    updateNodeInternals();
  });

  let cs = $derived<ContainerStyle>(schema?.containerStyle ?? {});

  let borderColor = $derived(cs.borderColor ?? 'var(--color-border, #2e3347)');
  let borderStyle = $derived(cs.borderStyle ?? 'dashed');
  let bg = $derived(cs.backgroundColor ?? 'color-mix(in srgb, var(--color-surface) 60%, transparent)');
  let headerColor = $derived(cs.headerColor ?? 'var(--color-text-muted, #8b90a0)');
  let radius = $derived(cs.borderRadius ?? 10);
  let borderWidth = $derived(cs.borderWidth ?? 1.5);
  let hideHeaderBorder = $derived(cs.hideHeaderBorder ?? false);
  let iconSize = $derived(cs.iconSize ?? 18);
  let labelSize = $derived(cs.labelSize ?? 12);
  let dashArray = $derived(cs.dashArray);
  let useSvgBorder = $derived(!!dashArray);

  // Drag feedback: highlight as valid (green) or invalid (red) drop target
  let isValidDropTarget = $derived(ui.dragFeedback?.validContainerIds.has(id) ?? false);
  let isInvalidDropTarget = $derived(ui.dragFeedback?.invalidContainerIds.has(id) ?? false);

  let hasNsg = $derived(!!data.references?.['nsg_id']);
  let nsgIcon = $derived(hasNsg ? registry.getIcon('azurerm/networking/network_security_group' as any) : null);

  // CIDR subtitle: show address_space (VNet) or address_prefixes (Subnet) in the header
  let cidrSubtitle = $derived.by(() => {
    const props = data.properties;
    const addressSpace = props?.address_space as string[] | undefined;
    if (addressSpace?.length) return addressSpace[0];
    const addressPrefixes = props?.address_prefixes as string[] | undefined;
    if (addressPrefixes?.length) return addressPrefixes[0];
    return null;
  });

  let hoverTimer: ReturnType<typeof setTimeout> | null = null;
  let showTooltip = $state(false);

  function onMouseEnter() {
    hoverTimer = setTimeout(() => { showTooltip = true; }, 300);
  }

  function onMouseLeave() {
    showTooltip = false;
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
  }

  /** After this container is resized, expand any parent that is now too small. */
  function handleResizeEnd(_event: unknown, params: { x: number; y: number; width: number; height: number }) {
    const PADDING = 20;
    // Walk up the parent chain
    let currentNodeId: string | undefined = id;
    while (currentNodeId) {
      const node = diagram.nodes.find((n) => n.id === currentNodeId);
      if (!node?.parentId) break;

      const parent = diagram.nodes.find((n) => n.id === node.parentId);
      if (!parent) break;

      // For the node that was just resized, use params (most accurate).
      // For ancestors, use their current stored dimensions.
      const childX = node.id === id ? params.x : (node.position?.x ?? 0);
      const childY = node.id === id ? params.y : (node.position?.y ?? 0);
      const childW = node.id === id ? params.width : (node.measured?.width ?? node.width ?? 250);
      const childH = node.id === id ? params.height : (node.measured?.height ?? node.height ?? 150);

      const parentW = parent.measured?.width ?? parent.width ?? 250;
      const parentH = parent.measured?.height ?? parent.height ?? 150;

      const neededW = childX + childW + PADDING;
      const neededH = childY + childH + PADDING;

      let changed = false;
      let newW = parentW;
      let newH = parentH;

      if (neededW > parentW) { newW = neededW; changed = true; }
      if (neededH > parentH) { newH = neededH; changed = true; }

      if (changed) {
        // Update parent dimensions via style (SvelteFlow reads width/height from the style attribute)
        diagram.nodes = diagram.nodes.map((n) =>
          n.id === parent.id
            ? { ...n, width: newW, height: newH, style: `width: ${newW}px; height: ${newH}px;` }
            : n
        );
      } else {
        break; // No expansion needed, stop walking up
      }

      currentNodeId = parent.id;
    }
    diagram.saveSnapshot();
  }
</script>

<NodeResizer minWidth={200} minHeight={120} isVisible={selected ?? false} onResizeEnd={handleResizeEnd} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="container-node"
  class:selected
  class:drop-valid={isValidDropTarget}
  class:drop-invalid={isInvalidDropTarget}
  style="border-color: {isInvalidDropTarget ? '#ef4444' : isValidDropTarget ? '#22c55e' : selected ? 'var(--color-accent, #3b82f6)' : borderColor}; border-style: {useSvgBorder && !isInvalidDropTarget && !isValidDropTarget ? 'none' : isInvalidDropTarget || isValidDropTarget ? 'solid' : borderStyle}; background: {isInvalidDropTarget ? 'rgba(239, 68, 68, 0.06)' : isValidDropTarget ? 'rgba(34, 197, 94, 0.06)' : bg}; border-radius: {radius}px; border-width: {useSvgBorder && !isInvalidDropTarget && !isValidDropTarget ? 0 : isInvalidDropTarget || isValidDropTarget ? 2.5 : borderWidth}px;"
  onmouseenter={onMouseEnter}
  onmouseleave={onMouseLeave}
>
  {#if useSvgBorder && !isInvalidDropTarget && !isValidDropTarget}
    <svg class="svg-border" xmlns="http://www.w3.org/2000/svg" style="--bw: {borderWidth}px;">
      <rect
        x="{borderWidth / 2}" y="{borderWidth / 2}"
        rx="{radius}" ry="{radius}"
        fill="none"
        stroke="{selected ? 'var(--color-accent, #3b82f6)' : borderColor}"
        stroke-width="{borderWidth}"
        stroke-dasharray="{dashArray}"
        stroke-linecap="round"
        class="svg-border-rect"
      />
    </svg>
  {/if}
  <div class="deployment-badge-corner">
    {#if hasNsg && nsgIcon?.type === 'svg' && nsgIcon.svg}
      <span class="nsg-badge" title="NSG attached">{@html nsgIcon.svg}</span>
    {/if}
    <DeploymentBadge status={data.deploymentStatus} />
  </div>
  <div class="container-header" style="border-bottom-color: {borderColor}; {hideHeaderBorder ? 'border-bottom: none;' : ''}">
    {#if icon?.type === 'svg' && icon.svg && iconSize > 0}
      <span class="node-icon" style="width: {iconSize}px; height: {iconSize}px;">{@html icon.svg}</span>
    {/if}
    <span class="node-label" style="color: {headerColor}; font-size: {labelSize}px;">{data.label || schema?.displayName || 'Container'}</span>
    {#if cidrSubtitle}
      <span class="cidr-subtitle">{cidrSubtitle}</span>
    {/if}
  </div>
  <div class="container-body"></div>

  {#each handles as handle, i (handle.id)}
    <HandleWithLabel {handle} nodeTypeId={data.typeId} style={handleStyles[i]} />
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
    padding: 0;
    min-width: 250px;
    min-height: 150px;
    width: 100%;
    height: 100%;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    display: flex;
    flex-direction: column;
  }
  .container-node.selected {
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
  }
  .container-node.drop-valid {
    box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.25);
  }
  .container-node.drop-invalid {
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.25);
  }
  .svg-border {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 0;
    overflow: visible;
  }
  .svg-border-rect {
    width: calc(100% - var(--bw, 3px));
    height: calc(100% - var(--bw, 3px));
  }
  .deployment-badge-corner {
    position: absolute;
    top: 10px;
    right: 12px;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .container-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    padding-right: 28px; /* leave room for badge */
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
    width: 100%;
    height: 100%;
  }
  .node-label {
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cidr-subtitle {
    font-size: 10px;
    font-weight: 400;
    color: var(--color-text-muted, #8b90a0);
    opacity: 0.7;
    white-space: nowrap;
    flex-shrink: 0;
    font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  }
  .container-body {
    flex: 1;
    min-height: 80px;
    padding: 8px;
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
</style>
