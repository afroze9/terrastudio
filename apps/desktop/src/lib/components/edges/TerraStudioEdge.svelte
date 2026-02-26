<script lang="ts">
  import {
    BaseEdge,
    EdgeLabel,
    getBezierPath,
    getSmoothStepPath,
    getStraightPath,
    Position,
  } from '@xyflow/svelte';
  import type { TerraStudioEdgeData, EdgeCategoryId } from '@terrastudio/types';
  import { edgeCategoryRegistry } from '@terrastudio/core';
  import { ui } from '$lib/stores/ui.svelte';
  import { project } from '$lib/stores/project.svelte';
  import { mergeEdgeStyles, computeEdgeStyle, getMarkerUrl, getMarkerStartUrl, DEFAULT_EDGE_STYLE } from './edge-utils';

  // Props from SvelteFlow EdgeTypes - using explicit types instead of EdgeProps generic
  // because svelte-check doesn't properly infer the generic parameter
  interface Props {
    id: string;
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
    sourcePosition: Position;
    targetPosition: Position;
    data?: TerraStudioEdgeData;
    selected?: boolean;
    label?: string;
  }

  let {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected = false,
    label,
  }: Props = $props();

  // Cast data to our edge data type (SvelteFlow passes it as any)
  const edgeData = $derived(data as TerraStudioEdgeData | undefined);

  // Get category definition
  const categoryId = $derived<EdgeCategoryId>(edgeData?.category ?? 'structural');
  const category = $derived(edgeCategoryRegistry.get(categoryId));
  const categoryDefault = $derived(category?.defaultStyle ?? DEFAULT_EDGE_STYLE);

  // Get project-level style settings for this category
  const projectSettings = $derived(project.projectConfig.edgeStyles?.[categoryId]);

  // Merge styles: category default < project settings < edge overrides
  const mergedStyle = $derived(mergeEdgeStyles(categoryDefault, projectSettings, edgeData?.styleOverrides));

  // Compute path based on global edge type setting
  const pathData = $derived.by(() => {
    const params = { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition };
    switch (ui.edgeType) {
      case 'smoothstep':
        return getSmoothStepPath(params);
      case 'step':
        return getSmoothStepPath({ ...params, borderRadius: 0 });
      case 'straight':
        return getStraightPath(params);
      default:
        return getBezierPath(params);
    }
  });

  // Compute final CSS style string
  const style = $derived(computeEdgeStyle(mergedStyle, selected ?? false));

  // Determine markers from merged style
  // markerStart uses reversed markers (-start suffix) so arrows point outward from source
  const markerStart = $derived(getMarkerStartUrl(mergedStyle.markerStart));
  const markerEnd = $derived(getMarkerUrl(mergedStyle.markerEnd));

  // Check if edge should be animated
  const isAnimated = $derived(mergedStyle.animated ?? false);

  // Use data.label if available, fall back to the label prop
  const displayLabel = $derived(edgeData?.label ?? label);
</script>

<BaseEdge
  {id}
  path={pathData[0]}
  {markerStart}
  {markerEnd}
  {style}
  class={[
    'terrastudio-edge',
    `category-${categoryId}`,
    selected && 'selected',
    isAnimated && 'animated',
  ].filter(Boolean).join(' ')}
/>

{#if displayLabel}
  <EdgeLabel x={pathData[1]} y={pathData[2]} class={`edge-label${selected ? ' selected' : ''}`}>
    {displayLabel}
  </EdgeLabel>
{/if}

<style>
  :global(.edge-label) {
    font-size: 11px;
    font-weight: 500;
    padding: 2px 6px;
    border-radius: 4px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  :global(.edge-label.selected) {
    border-color: var(--edge-selected, #3b82f6);
    color: var(--color-text);
  }

  /* Animation for binding/data flow edges */
  :global(.svelte-flow__edge.animated path),
  :global(.svelte-flow__edge.animated .react-flow__edge-path),
  :global(.terrastudio-edge.animated),
  :global(g.animated path) {
    stroke-dasharray: 5 !important;
    animation: edge-flow 0.5s linear infinite !important;
  }

  @keyframes edge-flow {
    from {
      stroke-dashoffset: 10;
    }
    to {
      stroke-dashoffset: 0;
    }
  }

  :global(.terrastudio-edge.selected path),
  :global(.svelte-flow__edge.selected path) {
    stroke: var(--edge-selected, #3b82f6) !important;
  }
</style>
