<script lang="ts">
  import { Handle, Position, useUpdateNodeInternals } from '@xyflow/svelte';
  import { registry } from '$lib/bootstrap';
  import { diagram } from '$lib/stores/diagram.svelte';
  import { terraform } from '$lib/stores/terraform.svelte';
  import { cost } from '$lib/stores/cost.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import { plan } from '$lib/stores/plan.svelte';
  import DeploymentBadge from './DeploymentBadge.svelte';
  import NodeTooltip from './NodeTooltip.svelte';
  import HandleWithLabel from './HandleWithLabel.svelte';
  import DirectionalArrows from './DirectionalArrows.svelte';
  import HandleMenu from './HandleMenu.svelte';
  import { connectionUx, type ArrowDirection, type HandleMenuEntry } from '$lib/stores/connection-ux.svelte';
  import type { HandleDefinition, HandlePositionOverrides } from '@terrastudio/types';

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
  // Plan review mode
  let planAction = $derived(plan.active ? plan.getNodeAction(id) : undefined);

  // User position overrides for handles
  let handlePositions = $derived((data.handlePositions as Record<string, string>) ?? {});

  // Apply position overrides to schema handles
  let staticHandles = $derived.by(() => {
    const schemaHandles = schema?.handles ?? [];
    return schemaHandles.map((h: HandleDefinition) => ({
      ...h,
      position: (handlePositions[h.id] ?? h.position) as 'top' | 'bottom' | 'left' | 'right',
    }));
  });

  // Render a source handle for each showAsEdge reference property (ref-{propKey})
  // so users can reposition the edge exit point via the Manage Handles dialog.
  let referenceHandles = $derived.by(() => {
    if (!schema?.properties) return [];
    return schema.properties
      .filter((p: { type: string; showAsEdge?: boolean; key: string; label: string }) => p.type === 'reference' && p.showAsEdge)
      .map((p: { key: string; label: string }) => {
        const handleId = `ref-${p.key}`;
        return {
          id: handleId,
          type: 'source' as const,
          position: (handlePositions[handleId] ?? 'right') as 'top' | 'bottom' | 'left' | 'right',
          label: p.label,
        };
      });
  });

  // Apply position overrides to dynamic output handles
  let dynamicOutputHandles = $derived.by(() => {
    if (!schema?.outputs) return [];
    const enabled = (data.enabledOutputs as string[]) ?? [];
    return schema.outputs
      .filter((o: { key: string }) => enabled.includes(o.key))
      .map((o: { key: string; label: string }) => {
        const handleId = `out-${o.key}`;
        return {
          id: handleId,
          type: 'source' as const,
          position: (handlePositions[handleId] ?? 'right') as 'top' | 'bottom' | 'left' | 'right',
          label: o.label,
        };
      });
  });

  // User-defined connection point handles for annotation edges
  let connectionPointHandles = $derived.by(() => {
    const config = data.connectionPoints as { top: number; bottom: number; left: number; right: number } | undefined;
    if (!config) return [];

    const handles: Array<{ id: string; type: 'source' | 'target'; position: string }> = [];
    const sides = ['top', 'bottom', 'left', 'right'] as const;

    for (const side of sides) {
      const count = config[side] ?? 0;
      for (let i = 0; i < count; i++) {
        // Each connection point creates both a source and target handle
        handles.push({
          id: `cp-${side}-${i}-source`,
          type: 'source',
          position: side,
        });
        handles.push({
          id: `cp-${side}-${i}-target`,
          type: 'target',
          position: side,
        });
      }
    }
    return handles;
  });

  let handles = $derived([...staticHandles, ...dynamicOutputHandles]);

  // Compute offsets so handles on the same side are evenly spaced
  // For left/right sides: use top percentage
  // For top/bottom sides: use left percentage
  let handleStyles = $derived.by(() => {
    const all = handles;
    const bySide = new Map<string, number[]>();
    all.forEach((h, i) => {
      const list = bySide.get(h.position) ?? [];
      list.push(i);
      bySide.set(h.position, list);
    });
    const styles: (string | undefined)[] = new Array(all.length);
    for (const [side, indices] of bySide) {
      if (indices.length <= 1) continue;
      const isVerticalSide = side === 'left' || side === 'right';
      indices.forEach((idx, rank) => {
        const pct = ((rank + 1) / (indices.length + 1)) * 100;
        styles[idx] = isVerticalSide ? `top: ${pct}%;` : `left: ${pct}%;`;
      });
    }
    return styles;
  });

  // Compute styles for connection point handles (positioned along edges)
  let connectionPointStyles = $derived.by(() => {
    const config = data.connectionPoints as { top: number; bottom: number; left: number; right: number } | undefined;
    if (!config) return new Map<string, string>();

    const styles = new Map<string, string>();
    const sides = ['top', 'bottom', 'left', 'right'] as const;

    for (const side of sides) {
      const count = config[side] ?? 0;
      for (let i = 0; i < count; i++) {
        const pct = ((i + 1) / (count + 1)) * 100;
        const sourceId = `cp-${side}-${i}-source`;
        const targetId = `cp-${side}-${i}-target`;

        if (side === 'top' || side === 'bottom') {
          styles.set(sourceId, `left: ${pct}%;`);
          styles.set(targetId, `left: ${pct}%;`);
        } else {
          styles.set(sourceId, `top: ${pct}%;`);
          styles.set(targetId, `top: ${pct}%;`);
        }
      }
    }
    return styles;
  });

  // When handles or their positions change, tell SvelteFlow to re-read handle positions
  // Must wait for DOM paint (tick is not enough — handles need to be in the DOM)
  $effect(() => {
    staticHandles;
    referenceHandles;
    dynamicOutputHandles;
    connectionPointHandles;
    handlePositions;
    updateNodeInternals();
  });

  let hasNsg = $derived(!!data.references?.['nsg_id']);
  let nsgIcon = $derived(hasNsg ? registry.getIcon('azurerm/networking/network_security_group' as any) : null);

  // PEP badge: show when resource has privateEndpointConfig and is inside a subnet
  let hasPep = $derived.by(() => {
    if (!schema?.privateEndpointConfig) return false;
    const thisNode = diagram.nodes.find((n) => n.id === id);
    if (!thisNode?.parentId) return false;
    const parentNode = diagram.nodes.find((n) => n.id === thisNode.parentId);
    return parentNode?.data.typeId === 'azurerm/networking/subnet';
  });
  let pepIcon = $derived(hasPep ? registry.getIcon('azurerm/networking/private_endpoint' as any) : null);
  let pepSubresources = $derived.by(() => {
    if (!hasPep) return '';
    const subs = data.properties?.['pep_subresources'] as string[] | undefined;
    if (subs && subs.length > 0) return subs.join(', ');
    return schema?.privateEndpointConfig?.defaultSubresource ?? '';
  });

  let costEstimate = $derived(ui.showCostBadges ? cost.estimates.get(id) : undefined);
  let costLabel = $derived.by(() => {
    if (!costEstimate || costEstimate.loading) return null;
    if (costEstimate.monthlyCost === null) return null;
    if (costEstimate.monthlyCost === 0) return 'Free';
    return `~$${costEstimate.monthlyCost < 10 ? costEstimate.monthlyCost.toFixed(2) : Math.round(costEstimate.monthlyCost)}/mo`;
  });

  let validationErrors = $derived((data.validationErrors as { message: string; severity: string }[]) ?? []);
  let hasValidationErrors = $derived(validationErrors.length > 0);
  let validationTooltip = $derived(validationErrors.map((e) => e.message).join('\n'));

  let hoverTimer: ReturnType<typeof setTimeout> | null = null;
  let showTooltip = $state(false);
  let isHovered = $state(false);
  let nodeEl: HTMLDivElement | undefined = $state();

  // Set of handle IDs on this node that have an edge connected
  let connectedHandleIds = $derived.by(() => {
    const ids = new Set<string>();
    for (const edge of diagram.edges) {
      if (edge.source === id && edge.sourceHandle) ids.add(edge.sourceHandle);
      if (edge.target === id && edge.targetHandle) ids.add(edge.targetHandle);
    }
    return ids;
  });

  // Connection UX: show arrows when this node is hovered, ghost handles when it's a valid target
  let showArrows = $derived(
    connectionUx.state === 'showing-arrows' && connectionUx.activeNodeId === id
    || connectionUx.state === 'menu-open' && connectionUx.activeNodeId === id
  );
  let showMenu = $derived(
    connectionUx.state === 'menu-open' && connectionUx.activeNodeId === id
  );
  let ghostHandleIds = $derived.by(() => {
    if (!connectionUx.isDragging) return new Set<string>();
    const ghosts = connectionUx.getGhostHandles(id);
    return new Set(ghosts.map((g) => g.handleId));
  });

  // Handle IDs explicitly made visible via the arrow menu
  let visibleHandleIds = $derived(new Set((data.visibleHandles as string[]) ?? []));

  function onArrowClick(direction: ArrowDirection) {
    const allEntries: HandleMenuEntry[] = handles.map((h) => ({
      handleId: h.id,
      label: h.label,
      type: h.type,
      position: h.position,
    }));
    connectionUx.openMenu(direction, allEntries);
  }

  function onHandleMenuToggle(entry: HandleMenuEntry) {
    const direction = connectionUx.activeDirection;
    const currentVisible = [...(data.visibleHandles as string[] ?? [])];
    const currentPositions = { ...(data.handlePositions as HandlePositionOverrides ?? {}) };
    const idx = currentVisible.indexOf(entry.handleId);

    if (idx >= 0) {
      // Toggle off: remove from visible list
      currentVisible.splice(idx, 1);
    } else {
      // Toggle on: add to visible list and position on the arrow's side
      currentVisible.push(entry.handleId);
      if (direction) {
        currentPositions[entry.handleId] = direction;
      }
    }

    diagram.updateNodeData(id, {
      visibleHandles: currentVisible,
      handlePositions: currentPositions,
    });
  }

  function onMouseEnter() {
    isHovered = true;
    hoverTimer = setTimeout(() => { showTooltip = true; }, 300);
    if (!connectionUx.isDragging) {
      connectionUx.hoverNode(id, data.typeId);
    }
  }

  function onMouseLeave() {
    isHovered = false;
    showTooltip = false;
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
    connectionUx.unhoverNode(id);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="resource-node"
  class:selected
  class:compact={ui.compactNodes}
  class:has-validation-errors={hasValidationErrors}
  class:plan-create={planAction === 'create'}
  class:plan-update={planAction === 'update'}
  class:plan-delete={planAction === 'delete'}
  class:plan-replace={planAction === 'replace'}
  class:plan-noop={planAction === 'no-op'}
  role="group"
  aria-label={`${data.label || schema?.displayName || 'Resource'} (${schema?.terraformType ?? data.typeId})`}
  onmouseenter={onMouseEnter}
  onmouseleave={onMouseLeave}
  onclick={planAction ? () => { plan.diffNodeId = id; } : undefined}
  bind:this={nodeEl}
>
  {#if ui.compactNodes}
    <!-- Compact: icon-only box, label floats outside bounding box -->
    <div class="compact-icon-wrap">
      {#if icon?.type === 'svg' && icon.svg}
        <span class="compact-icon">{@html icon.svg}</span>
      {/if}
      <DeploymentBadge status={data.deploymentStatus} {errorMessage} />
      {#if hasValidationErrors}
        <span class="compact-validation" title={validationTooltip}>!</span>
      {/if}
      {#if hasNsg && nsgIcon?.type === 'svg' && nsgIcon.svg}
        <span class="compact-badge compact-badge-nsg" title="NSG attached">{@html nsgIcon.svg}</span>
      {/if}
      {#if hasPep && pepIcon?.type === 'svg' && pepIcon.svg}
        <span class="compact-badge compact-badge-pep" title="Private Endpoint ({pepSubresources})">{@html pepIcon.svg}</span>
      {/if}
    </div>
    <span class="compact-label">{data.label || schema?.displayName || 'Resource'}</span>
  {:else}
    <!-- Detailed card view -->
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
      {#if hasPep && pepIcon?.type === 'svg' && pepIcon.svg}
        <span class="pep-badge" title="Private Endpoint ({pepSubresources})">{@html pepIcon.svg}</span>
      {/if}
      {#if hasValidationErrors}
        <span class="validation-badge" title={validationTooltip}>!</span>
      {/if}
      <DeploymentBadge status={data.deploymentStatus} {errorMessage} />
    </div>

    {#if costLabel}
      <div class="cost-badge">{costLabel}</div>
    {/if}
  {/if}

  {#each handles as handle, i (handle.id)}
    <HandleWithLabel {handle} nodeTypeId={data.typeId} style={handleStyles[i]} compact={ui.compactNodes} hovered={isHovered} connected={connectedHandleIds.has(handle.id)} ghost={ghostHandleIds.has(handle.id)} visible={visibleHandleIds.has(handle.id)} />
  {/each}

  {#if showArrows && !connectionUx.isDragging}
    <DirectionalArrows {onArrowClick} />
  {/if}

  {#if showMenu && connectionUx.activeDirection}
    <HandleMenu
      handles={connectionUx.menuHandles}
      direction={connectionUx.activeDirection}
      pinnedIds={visibleHandleIds}
      onToggle={onHandleMenuToggle}
      onClose={() => connectionUx.closeMenu()}
    />
  {/if}

  <!-- User-defined connection point handles for annotation edges -->
  {#each connectionPointHandles as cpHandle (cpHandle.id)}
    <Handle
      type={cpHandle.type}
      position={cpHandle.position === 'top' ? Position.Top : cpHandle.position === 'bottom' ? Position.Bottom : cpHandle.position === 'left' ? Position.Left : Position.Right}
      id={cpHandle.id}
      class="connection-point-handle"
      style={connectionPointStyles.get(cpHandle.id)}
    />
  {/each}

  <!-- Reference edge handles: non-connectable anchors for showAsEdge properties.
       Position is user-overridable via the Manage Handles dialog. -->
  {#each referenceHandles as refHandle (refHandle.id)}
    <Handle
      type="source"
      position={refHandle.position === 'top' ? Position.Top : refHandle.position === 'bottom' ? Position.Bottom : refHandle.position === 'left' ? Position.Left : Position.Right}
      id={refHandle.id}
      class="reference-handle"
      isConnectable={false}
    />
  {/each}

  <!-- Ghost handles: invisible, non-connectable anchors used by reference edges
       when no specific handle is defined on the node. -->
  <Handle type="source" position={Position.Right} style="opacity:0;pointer-events:none;" isConnectable={false} />
  <Handle type="target" position={Position.Left}  style="opacity:0;pointer-events:none;" isConnectable={false} />

  {#if schema && !selected}
    <NodeTooltip
      {schema}
      terraformName={data.terraformName}
      deploymentStatus={data.deploymentStatus}
      properties={data.properties}
      visible={showTooltip}
      anchorEl={nodeEl}
    />
  {/if}
</div>

<style>
  .resource-node {
    position: relative;
    background: #1a1d27;
    border: 1.5px solid #2e3347;
    border-radius: 8px;
    padding: 10px 14px;
    width: 220px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .resource-node.selected {
    border-color: #3b82f6;
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
    font-size: var(--font-13);
    font-weight: 600;
    color: #e1e4ed;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .node-type {
    font-size: var(--font-10);
    color: #8b90a0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
  .pep-badge {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    cursor: help;
  }
  .pep-badge :global(svg) {
    width: 16px;
    height: 16px;
  }
  .validation-badge {
    width: 15px;
    height: 15px;
    border-radius: 50%;
    background: #ef4444;
    color: #fff;
    font-size: var(--font-10);
    font-weight: 700;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    cursor: help;
  }

  .cost-badge {
    font-size: var(--font-9);
    color: #8b90a0;
    text-align: center;
    margin-top: 3px;
    opacity: 0.75;
    letter-spacing: 0.02em;
  }

  /* ---- Compact (Visio-style) mode ---- */
  /* Node dimensions are based ONLY on the icon (56x56 = 48px icon + 4px padding each side).
     The label is positioned absolutely so it doesn't affect the bounding box,
     giving correct alignment/snapping behavior like draw.io or Visio. */
  .resource-node.compact {
    width: 56px;
    height: 56px;
    background: transparent;
    border: none;
    padding: 4px;
    box-shadow: none;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: visible;
  }
  .resource-node.compact.selected {
    border: none;
    box-shadow: none;
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
    border-radius: 6px;
  }
  .resource-node.compact.has-validation-errors {
    border: none;
    box-shadow: none;
  }
  .compact-icon-wrap {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .compact-icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .compact-icon :global(svg) {
    width: 48px;
    height: 48px;
  }
  .compact-icon-wrap :global(.badge) {
    position: absolute;
    bottom: -2px;
    right: -2px;
  }
  .compact-badge {
    position: absolute;
    width: 14px;
    height: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .compact-badge :global(svg) {
    width: 14px;
    height: 14px;
  }
  .compact-badge-nsg {
    top: -4px;
    left: -4px;
  }
  .compact-badge-pep {
    bottom: -4px;
    left: -4px;
  }
  .compact-validation {
    position: absolute;
    top: -4px;
    right: -4px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #ef4444;
    color: #fff;
    font-size: var(--font-8);
    font-weight: 700;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: help;
  }
  .compact-label {
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-top: 2px;
    font-size: var(--font-11);
    font-weight: 600;
    color: #1a1a2e;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100px;
    line-height: 1.2;
    paint-order: stroke fill;
    -webkit-text-stroke: 3px rgba(255, 255, 255, 0.85);
    text-shadow: none;
    pointer-events: none;
  }

  /* Reference edge handles — subtle dot, non-interactive */
  :global(.reference-handle) {
    width: 6px !important;
    height: 6px !important;
    background: #8b90a0 !important;
    border: 1px solid #1a1d27 !important;
    border-radius: 50% !important;
    pointer-events: none !important;
    opacity: 0.6 !important;
  }

  /* Connection point handles for annotation edges */
  :global(.connection-point-handle) {
    width: 8px !important;
    height: 8px !important;
    background: var(--edge-annotation, #f59e0b) !important;
    border: 2px solid #1a1d27 !important;
    border-radius: 50% !important;
  }
  :global(.connection-point-handle:hover) {
    background: #3b82f6 !important;
    transform: scale(1.3);
  }

  /* Plan review mode highlights */
  .resource-node.plan-create {
    border-color: #22c55e;
    box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.3), 0 0 12px rgba(34, 197, 94, 0.15);
    animation: plan-pulse-create 2s ease-in-out 3;
  }
  .resource-node.plan-update {
    border-color: #f59e0b;
    box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.3), 0 0 12px rgba(245, 158, 11, 0.15);
    animation: plan-pulse-update 2s ease-in-out 3;
  }
  .resource-node.plan-delete {
    border-color: #ef4444;
    box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.3), 0 0 12px rgba(239, 68, 68, 0.15);
    animation: plan-pulse-delete 2s ease-in-out 3;
  }
  .resource-node.plan-replace {
    border-color: #f97316;
    box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.3), 0 0 12px rgba(249, 115, 22, 0.15);
    animation: plan-pulse-replace 2s ease-in-out 3;
  }
  .resource-node.plan-noop {
    border-color: #6b7280;
    opacity: 0.6;
  }

  @keyframes plan-pulse-create {
    0%, 100% { box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.3), 0 0 12px rgba(34, 197, 94, 0.15); }
    50% { box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.5), 0 0 24px rgba(34, 197, 94, 0.3); }
  }
  @keyframes plan-pulse-update {
    0%, 100% { box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.3), 0 0 12px rgba(245, 158, 11, 0.15); }
    50% { box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.5), 0 0 24px rgba(245, 158, 11, 0.3); }
  }
  @keyframes plan-pulse-delete {
    0%, 100% { box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.3), 0 0 12px rgba(239, 68, 68, 0.15); }
    50% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.5), 0 0 24px rgba(239, 68, 68, 0.3); }
  }
  @keyframes plan-pulse-replace {
    0%, 100% { box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.3), 0 0 12px rgba(249, 115, 22, 0.15); }
    50% { box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.5), 0 0 24px rgba(249, 115, 22, 0.3); }
  }
</style>
