<script lang="ts">
  import { Handle, NodeResizer, Position, useUpdateNodeInternals } from '@xyflow/svelte';
  import { tick } from 'svelte';
  import { registry } from '$lib/bootstrap';
  import { diagram } from '$lib/stores/diagram.svelte';
  import { terraform } from '$lib/stores/terraform.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import { cost } from '$lib/stores/cost.svelte';
  import { plan } from '$lib/stores/plan.svelte';
  import DeploymentBadge from './DeploymentBadge.svelte';
  import NodeTooltip from './NodeTooltip.svelte';
  import HandleWithLabel from './HandleWithLabel.svelte';
  import DirectionalArrows from './DirectionalArrows.svelte';
  import HandleMenu from './HandleMenu.svelte';
  import { connectionUx, type ArrowDirection, type HandleMenuEntry } from '$lib/stores/connection-ux.svelte';
  import type { ContainerStyle, HandleDefinition, HandlePositionOverrides, NodeFormatting } from '@terrastudio/types';

  const updateNodeInternals = useUpdateNodeInternals();

  let { data, id, selected }: { data: any; id: string; selected?: boolean } = $props();

  let schema = $derived(registry.getResourceSchema(data.typeId));
  let icon = $derived(schema ? registry.getIcon(data.typeId) : null);

  /** Canvas label: displayLabel overrides everything; otherwise use label (kept in sync with naming convention). */
  let canvasLabel = $derived((data.displayLabel || data.label || schema?.displayName || 'Container') as string);

  // Get error message for this resource if any
  let errorMessage = $derived.by(() => {
    if (data.deploymentStatus !== 'failed') return undefined;
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
  let handles = $derived([...staticHandles, ...dynamicOutputHandles]);

  // User-defined connection point handles for annotation edges
  let connectionPointHandles = $derived.by(() => {
    const config = data.connectionPoints as { top: number; bottom: number; left: number; right: number } | undefined;
    if (!config) return [];

    const handles: Array<{ id: string; type: 'source' | 'target'; position: string }> = [];
    const sides = ['top', 'bottom', 'left', 'right'] as const;

    for (const side of sides) {
      const count = config[side] ?? 0;
      for (let i = 0; i < count; i++) {
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

  // When handles or their positions change, tell SvelteFlow to re-read handle positions.
  // Must wait for DOM paint — handles need to be rendered before SvelteFlow measures them.
  $effect(() => {
    staticHandles;
    referenceHandles;
    dynamicOutputHandles;
    connectionPointHandles;
    handlePositions;
    // Defer until after Svelte flushes DOM updates and the browser paints
    tick().then(() => requestAnimationFrame(() => updateNodeInternals()));
  });



  // Dynamic minimum size: max of schema minSize and the space children actually need
  let minW = $derived.by(() => {
    const schemaMin = schema?.minSize?.width ?? 200;
    const PADDING = 20;
    const children = diagram.nodes.filter((n) => n.parentId === id);
    if (children.length === 0) return schemaMin;
    let maxRight = 0;
    for (const c of children) {
      const cw = c.measured?.width ?? (c.width as number | undefined) ?? 250;
      maxRight = Math.max(maxRight, c.position.x + cw);
    }
    return Math.max(schemaMin, maxRight + PADDING);
  });
  let minH = $derived.by(() => {
    const schemaMin = schema?.minSize?.height ?? 120;
    const PADDING = 20;
    const children = diagram.nodes.filter((n) => n.parentId === id);
    if (children.length === 0) return schemaMin;
    let maxBottom = 0;
    for (const c of children) {
      const ch = c.measured?.height ?? (c.height as number | undefined) ?? 80;
      maxBottom = Math.max(maxBottom, c.position.y + ch);
    }
    return Math.max(schemaMin, maxBottom + PADDING);
  });

  let cs = $derived<ContainerStyle>(schema?.containerStyle ?? {});
  let fmt = $derived((data.formatting as NodeFormatting | undefined) ?? {});

  let borderColor = $derived(fmt.borderColor ?? cs.borderColor ?? '#2e3347');
  let borderStyle = $derived(fmt.borderStyle ?? cs.borderStyle ?? 'dashed');
  let bg = $derived(fmt.backgroundColor ?? cs.backgroundColor ?? 'rgba(26, 29, 39, 0.6)');
  let headerColor = $derived(fmt.headerColor ?? cs.headerColor ?? '#8b90a0');
  let radius = $derived(fmt.borderRadius ?? cs.borderRadius ?? 10);
  let borderWidth = $derived(fmt.borderWidth ?? cs.borderWidth ?? 1.5);
  let hideHeaderBorder = $derived(cs.hideHeaderBorder ?? false);
  let iconSize = $derived(cs.iconSize ?? 18);
  let labelSize = $derived(Math.round((cs.labelSize ?? 12) * (ui.fontScale / 100)));
  let dashArray = $derived(cs.dashArray);
  let containerOpacity = $derived(fmt.opacity);
  let containerLabelStyle = $derived.by(() => {
    const parts: string[] = [];
    parts.push(`color: ${headerColor}`);
    parts.push(`font-size: ${labelSize}px`);
    if (fmt.textAlign) parts.push(`text-align: ${fmt.textAlign}`);
    if (fmt.fontSize) {
      const sizeMap = { small: '11px', medium: '13px', large: '16px' };
      parts.push(`font-size: ${sizeMap[fmt.fontSize]}`);
    }
    if (fmt.fontBold) parts.push('font-weight: bold');
    if (fmt.fontItalic) parts.push('font-style: italic');
    return parts.join('; ') + ';';
  });
  let useSvgBorder = $derived(!!dashArray);

  // Drag feedback: highlight as valid (green) or invalid (red) drop target
  let isValidDropTarget = $derived(ui.dragFeedback?.validContainerIds.has(id) ?? false);
  let isInvalidDropTarget = $derived(ui.dragFeedback?.invalidContainerIds.has(id) ?? false);

  // Aggregate cost: sum all descendant resource costs (containers themselves are $0)
  let aggregateCost = $derived.by(() => {
    if (!ui.showCostBadges || !cost.hasPrices) return null;
    const nodeMap = new Map(diagram.nodes.map((n) => [n.id, n]));
    let total = 0;
    let hasAny = false;
    for (const node of diagram.nodes) {
      if (node.id.startsWith('_')) continue;
      if (node.id === id) continue;
      // Walk parent chain to check if this node is a descendant
      let cur = node;
      let isDesc = false;
      while (cur.parentId) {
        if (cur.parentId === id) { isDesc = true; break; }
        const parent = nodeMap.get(cur.parentId as string);
        if (!parent) break;
        cur = parent;
      }
      if (!isDesc) continue;
      const est = cost.estimates.get(node.id);
      if (est?.monthlyCost != null) { total += est.monthlyCost; hasAny = true; }
    }
    return hasAny ? total : null;
  });
  let costLabel = $derived.by(() => {
    if (aggregateCost === null || aggregateCost === 0) return null;
    return `~$${aggregateCost < 10 ? aggregateCost.toFixed(2) : Math.round(aggregateCost)}/mo`;
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

  let validationErrors = $derived((data.validationErrors as { message: string; severity: string }[]) ?? []);
  let hasValidationErrors = $derived(validationErrors.length > 0);
  let validationTooltip = $derived(validationErrors.map((e) => e.message).join('\n'));

  // CIDR subtitle: show address_space (VNet) or address_prefixes (Subnet) in the header
  let cidrSubtitle = $derived.by(() => {
    const props = data.properties;
    // Azure VNet
    const addressSpace = props?.address_space as string[] | undefined;
    if (addressSpace?.length) return addressSpace[0];
    // Azure Subnet
    const addressPrefixes = props?.address_prefixes as string[] | undefined;
    if (addressPrefixes?.length) return addressPrefixes[0];
    // AWS VPC / Subnet
    const cidrBlock = props?.cidr_block as string | undefined;
    if (cidrBlock) return cidrBlock;
    return null;
  });

  let hoverTimer: ReturnType<typeof setTimeout> | null = null;
  let showTooltip = $state(false);
  let isHovered = $state(false);
  let nodeEl: HTMLDivElement | undefined = $state();

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

  // Annotation count for the active arrow direction
  let annotationCountForDirection = $derived.by(() => {
    const dir = connectionUx.activeDirection;
    if (!dir) return 0;
    const config = (data.connectionPoints as { top: number; bottom: number; left: number; right: number }) ?? { top: 0, bottom: 0, left: 0, right: 0 };
    return config[dir] ?? 0;
  });

  function onAddAnnotation() {
    const dir = connectionUx.activeDirection;
    if (!dir) return;
    const config = { ...((data.connectionPoints as { top: number; bottom: number; left: number; right: number }) ?? { top: 0, bottom: 0, left: 0, right: 0 }) };
    if (config[dir] < 5) {
      config[dir]++;
      diagram.updateNodeData(id, { connectionPoints: config });
    }
  }

  function onRemoveAnnotation() {
    const dir = connectionUx.activeDirection;
    if (!dir) return;
    const config = { ...((data.connectionPoints as { top: number; bottom: number; left: number; right: number }) ?? { top: 0, bottom: 0, left: 0, right: 0 }) };
    if (config[dir] > 0) {
      // Remove edges connected to the handle being deleted (last index on this side)
      const removedIdx = config[dir] - 1;
      const removedSource = `cp-${dir}-${removedIdx}-source`;
      const removedTarget = `cp-${dir}-${removedIdx}-target`;
      const edgesToRemove = diagram.edges.filter(
        (e) =>
          (e.source === id && (e.sourceHandle === removedSource || e.sourceHandle === removedTarget)) ||
          (e.target === id && (e.targetHandle === removedSource || e.targetHandle === removedTarget))
      );
      for (const edge of edgesToRemove) {
        diagram.removeEdge(edge.id);
      }
      config[dir]--;
      diagram.updateNodeData(id, { connectionPoints: config });
    }
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

  /** Snap resize to grid during drag — mutates the params so SvelteFlow applies snapped dimensions. */
  function handleResize(_event: unknown, params: { x: number; y: number; width: number; height: number }) {
    if (ui.snapToGrid && ui.gridSize > 0) {
      const g = ui.gridSize;
      params.width = Math.round(params.width / g) * g;
      params.height = Math.round(params.height / g) * g;
      params.x = Math.round(params.x / g) * g;
      params.y = Math.round(params.y / g) * g;
    }
  }

  /** After this container is resized, expand any parent that is now too small. */
  function handleResizeEnd(_event: unknown, params: { x: number; y: number; width: number; height: number }) {
    // Final snap (in case onResize didn't catch the last frame)
    if (ui.snapToGrid && ui.gridSize > 0) {
      const g = ui.gridSize;
      params.width = Math.round(params.width / g) * g;
      params.height = Math.round(params.height / g) * g;
      params.x = Math.round(params.x / g) * g;
      params.y = Math.round(params.y / g) * g;
      diagram.nodes = diagram.nodes.map((n) =>
        n.id === id
          ? { ...n, width: params.width, height: params.height, position: { x: params.x, y: params.y }, style: `width: ${params.width}px; height: ${params.height}px;` }
          : n
      );
    }
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

<NodeResizer minWidth={minW} minHeight={minH} isVisible={selected ?? false} onResize={handleResize} onResizeEnd={handleResizeEnd} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="container-node"
  class:selected
  class:drop-valid={isValidDropTarget}
  class:drop-invalid={isInvalidDropTarget}
  class:has-validation-errors={hasValidationErrors && !isInvalidDropTarget && !isValidDropTarget}
  class:plan-create={planAction === 'create'}
  class:plan-update={planAction === 'update'}
  class:plan-delete={planAction === 'delete'}
  class:plan-replace={planAction === 'replace'}
  class:plan-noop={planAction === 'no-op'}
  role="group"
  aria-label={`${canvasLabel} (${schema?.terraformType ?? data.typeId})`}
  style="border-color: {isInvalidDropTarget ? '#ef4444' : isValidDropTarget ? '#22c55e' : hasValidationErrors ? '#ef4444' : selected ? '#3b82f6' : borderColor}; border-style: {useSvgBorder && !isInvalidDropTarget && !isValidDropTarget && !hasValidationErrors ? 'none' : isInvalidDropTarget || isValidDropTarget || hasValidationErrors ? 'solid' : borderStyle}; background: {isInvalidDropTarget ? 'rgba(239, 68, 68, 0.06)' : isValidDropTarget ? 'rgba(34, 197, 94, 0.06)' : hasValidationErrors ? 'rgba(239, 68, 68, 0.04)' : bg}; border-radius: {radius}px; border-width: {useSvgBorder && !isInvalidDropTarget && !isValidDropTarget && !hasValidationErrors ? 0 : isInvalidDropTarget || isValidDropTarget ? 2.5 : hasValidationErrors ? 2 : borderWidth}px;{containerOpacity != null ? ` opacity: ${containerOpacity};` : ''}"
  onmouseenter={onMouseEnter}
  onmouseleave={onMouseLeave}
  bind:this={nodeEl}
>
  {#if useSvgBorder && !isInvalidDropTarget && !isValidDropTarget && !hasValidationErrors}
    <svg class="svg-border" xmlns="http://www.w3.org/2000/svg" style="--bw: {borderWidth}px;">
      <rect
        x="{borderWidth / 2}" y="{borderWidth / 2}"
        rx="{radius}" ry="{radius}"
        fill="none"
        stroke="{selected ? '#3b82f6' : borderColor}"
        stroke-width="{borderWidth}"
        stroke-dasharray="{dashArray}"
        stroke-linecap="round"
        class="svg-border-rect"
      />
    </svg>
  {/if}
  <div class="deployment-badge-corner">
    {#if costLabel}
      <span class="cost-chip">{costLabel}</span>
    {/if}
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
  <div class="container-header" style="border-bottom-color: {borderColor}; {hideHeaderBorder ? 'border-bottom: none;' : ''}">
    {#if icon?.type === 'svg' && icon.svg && iconSize > 0}
      <span class="node-icon" style="width: {iconSize}px; height: {iconSize}px;">{@html icon.svg}</span>
    {/if}
    <span class="node-label" style={containerLabelStyle}>{canvasLabel}</span>
    {#if cidrSubtitle}
      <span class="cidr-subtitle">{cidrSubtitle}</span>
    {/if}
  </div>
  <div class="container-body"></div>

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
      annotationCount={annotationCountForDirection}
      anchorEl={nodeEl}
      onToggle={onHandleMenuToggle}
      {onAddAnnotation}
      {onRemoveAnnotation}
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

  <!-- Ghost handles: invisible, non-connectable anchors for reference edges -->
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
    font-size: var(--font-12);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cidr-subtitle {
    font-size: var(--font-10);
    font-weight: 400;
    color: #8b90a0;
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
  .cost-chip {
    font-size: var(--font-9);
    color: #8b90a0;
    opacity: 0.8;
    white-space: nowrap;
    letter-spacing: 0.02em;
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
  .container-node.has-validation-errors {
    box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
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

  /* Connection point handles for annotation edges.
     Each annotation point has a source + target handle stacked at the same spot.
     The target sits behind the source; only the source shows the visible dot. */
  :global(.connection-point-handle) {
    width: 8px !important;
    height: 8px !important;
    border-radius: 50% !important;
  }
  :global(.connection-point-handle[data-handleid$="-source"]) {
    background: var(--edge-annotation, #f59e0b) !important;
    border: 2px solid #1a1d27 !important;
    z-index: 2;
  }
  :global(.connection-point-handle[data-handleid$="-target"]) {
    background: transparent !important;
    border-color: transparent !important;
    z-index: 1;
  }
  :global(.connection-point-handle[data-handleid$="-source"]:hover) {
    background: #3b82f6 !important;
    /* Must preserve SvelteFlow's translate so the handle stays centered on the edge */
    scale: 1.3;
  }

  /* Plan review mode highlights (box-shadow doesn't conflict with inline border-color) */
  .container-node.plan-create {
    box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.4), 0 0 16px rgba(34, 197, 94, 0.2);
    animation: plan-pulse-create 2s ease-in-out 3;
  }
  .container-node.plan-update {
    box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.4), 0 0 16px rgba(245, 158, 11, 0.2);
    animation: plan-pulse-update 2s ease-in-out 3;
  }
  .container-node.plan-delete {
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.4), 0 0 16px rgba(239, 68, 68, 0.2);
    animation: plan-pulse-delete 2s ease-in-out 3;
  }
  .container-node.plan-replace {
    box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.4), 0 0 16px rgba(249, 115, 22, 0.2);
    animation: plan-pulse-replace 2s ease-in-out 3;
  }
  .container-node.plan-noop {
    opacity: 0.6;
  }

  @keyframes plan-pulse-create {
    0%, 100% { box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.4), 0 0 16px rgba(34, 197, 94, 0.2); }
    50% { box-shadow: 0 0 0 5px rgba(34, 197, 94, 0.6), 0 0 28px rgba(34, 197, 94, 0.35); }
  }
  @keyframes plan-pulse-update {
    0%, 100% { box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.4), 0 0 16px rgba(245, 158, 11, 0.2); }
    50% { box-shadow: 0 0 0 5px rgba(245, 158, 11, 0.6), 0 0 28px rgba(245, 158, 11, 0.35); }
  }
  @keyframes plan-pulse-delete {
    0%, 100% { box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.4), 0 0 16px rgba(239, 68, 68, 0.2); }
    50% { box-shadow: 0 0 0 5px rgba(239, 68, 68, 0.6), 0 0 28px rgba(239, 68, 68, 0.35); }
  }
  @keyframes plan-pulse-replace {
    0%, 100% { box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.4), 0 0 16px rgba(249, 115, 22, 0.2); }
    50% { box-shadow: 0 0 0 5px rgba(249, 115, 22, 0.6), 0 0 28px rgba(249, 115, 22, 0.35); }
  }
</style>
