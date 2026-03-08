<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';
  import { diagram } from '$lib/stores/diagram.svelte';
  import { cost } from '$lib/stores/cost.svelte';
  import { ui } from '$lib/stores/ui.svelte';

  let { data, id, selected }: { data: any; id: string; selected?: boolean } = $props();

  const moduleId = $derived(data.moduleId as string);
  const mod = $derived(diagram.modules.find((m) => m.id === moduleId));
  const memberCount = $derived(data.memberCount as number ?? 0);
  const borderColor = $derived(mod?.color ?? '#6366f1');

  /** Derived handles from cross-module edges (persisted + reference edges) */
  const derivedHandles = $derived.by(() => {
    const handles: Array<{ id: string; type: 'source' | 'target'; position: 'left' | 'right'; label: string }> = [];
    if (!moduleId) return handles;

    const memberIds = new Set(
      diagram.nodes.filter((n) => n.data.moduleId === moduleId).map((n) => n.id),
    );

    // Deduplicate by handle ID (matches the handle IDs used in displayEdges redirection)
    const seenHandleIds = new Set<string>();
    const allEdges = [...diagram.edges, ...diagram.referenceEdges];

    for (const edge of allEdges) {
      const srcIn = memberIds.has(edge.source);
      const tgtIn = memberIds.has(edge.target);

      if (srcIn && !tgtIn) {
        // Outgoing: source inside module → target outside
        const handleId = `mod-out-${edge.source}-${edge.sourceHandle ?? 'default'}`;
        if (!seenHandleIds.has(handleId)) {
          seenHandleIds.add(handleId);
          handles.push({
            id: handleId,
            type: 'source',
            position: 'right',
            label: (edge.data as any)?.label ?? '',
          });
        }
      } else if (!srcIn && tgtIn) {
        // Incoming: source outside → target inside module
        const handleId = `mod-in-${edge.target}-${edge.targetHandle ?? 'default'}`;
        if (!seenHandleIds.has(handleId)) {
          seenHandleIds.add(handleId);
          handles.push({
            id: handleId,
            type: 'target',
            position: 'left',
            label: (edge.data as any)?.label ?? '',
          });
        }
      }
    }

    return handles;
  });

  const sourceHandles = $derived(derivedHandles.filter((h) => h.type === 'source'));
  const targetHandles = $derived(derivedHandles.filter((h) => h.type === 'target'));
  const maxHandles = $derived(Math.max(sourceHandles.length, targetHandles.length));
  // Base height for header + hint; add space per handle row beyond what the base covers
  const nodeMinHeight = $derived(Math.max(60, 40 + maxHandles * 20));

  // Sum costs of all non-synthetic member nodes belonging to this module
  const moduleCost = $derived.by(() => {
    if (!ui.showCostBadges || !moduleId || !cost.hasPrices) return null;
    const memberIds = new Set(
      diagram.nodes
        .filter((n) => n.data.moduleId === moduleId && !n.id.startsWith('_'))
        .map((n) => n.id),
    );
    let total = 0;
    let hasAny = false;
    for (const mid of memberIds) {
      const est = cost.estimates.get(mid);
      if (est?.monthlyCost != null) { total += est.monthlyCost; hasAny = true; }
    }
    return hasAny ? total : null;
  });

  const moduleCostLabel = $derived.by(() => {
    if (moduleCost === null || moduleCost === 0) return null;
    return moduleCost < 10 ? `~$${moduleCost.toFixed(2)}/mo` : `~$${Math.round(moduleCost)}/mo`;
  });

  function handleExpand() {
    if (moduleId) diagram.toggleModuleCollapsed(moduleId);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="module-node"
  class:selected
  role="group"
  aria-label={`Module: ${mod?.name ?? 'Module'}`}
  style:--module-color={borderColor}
  style:min-height="{nodeMinHeight}px"
  ondblclick={handleExpand}
>
  <div class="module-node-header">
    <svg class="module-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke-dasharray="3 2" />
      <rect x="4" y="4" width="3.5" height="3.5" rx="0.5" fill="currentColor" stroke="none" opacity="0.4" />
      <rect x="8.5" y="4" width="3.5" height="3.5" rx="0.5" fill="currentColor" stroke="none" opacity="0.4" />
      <rect x="4" y="8.5" width="3.5" height="3.5" rx="0.5" fill="currentColor" stroke="none" opacity="0.4" />
    </svg>
    <span class="module-node-name">{mod?.name ?? 'Module'}</span>
    <span class="module-node-badge">{memberCount}</span>
    {#if moduleCostLabel}
      <span class="cost-chip">{moduleCostLabel}</span>
    {/if}
  </div>
  <div class="module-node-hint">Double-click to expand</div>

  {#each targetHandles as handle, i (handle.id)}
    {@const pct = (i + 1) / (targetHandles.length + 1) * 100}
    <Handle
      type="target"
      position={Position.Left}
      id={handle.id}
      style="top: {pct}%;"
    />
  {/each}

  {#each sourceHandles as handle, i (handle.id)}
    {@const pct = (i + 1) / (sourceHandles.length + 1) * 100}
    <Handle
      type="source"
      position={Position.Right}
      id={handle.id}
      style="top: {pct}%;"
    />
  {/each}
</div>

<style>
  .module-node {
    min-width: 160px;
    background: #1e1e2e;
    border: 2px solid var(--module-color);
    border-radius: 8px;
    padding: 10px 14px;
    font-family: inherit;
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .module-node.selected {
    box-shadow: 0 0 0 2px var(--module-color);
  }

  .module-node-header {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .module-icon {
    color: var(--module-color);
    flex-shrink: 0;
  }

  .module-node-name {
    font-size: var(--font-12);
    font-weight: 600;
    color: #cdd6f4;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .module-node-badge {
    font-size: var(--font-10);
    font-weight: 600;
    color: white;
    background: var(--module-color);
    border-radius: 8px;
    padding: 1px 6px;
    min-width: 18px;
    text-align: center;
    margin-left: auto;
  }

  .cost-chip {
    font-size: var(--font-9);
    color: #8b90a0;
    opacity: 0.8;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }

  .module-node-hint {
    font-size: var(--font-10);
    color: #6c7086;
    margin-top: 4px;
  }
</style>
