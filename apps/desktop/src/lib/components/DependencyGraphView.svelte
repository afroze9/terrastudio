<script lang="ts">
  import { SvelteFlow, Controls, Background, BackgroundVariant } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import { depGraph } from '$lib/stores/dep-graph.svelte';
  import { diagram } from '$lib/stores/diagram.svelte';
  import DepGraphNode from './DepGraphNode.svelte';
  import type { DepGraphNodeData } from '$lib/services/dep-graph-layout';
  import type { Node } from '@xyflow/svelte';

  const nodeTypes = { 'dep-graph-node': DepGraphNode };

  // Trigger refresh when diagram changes
  let prevNodeCount = $state(0);
  let prevEdgeCount = $state(0);

  $effect(() => {
    const nc = diagram.nodes.length;
    const ec = diagram.edges.length;
    if (nc !== prevNodeCount || ec !== prevEdgeCount) {
      prevNodeCount = nc;
      prevEdgeCount = ec;
      depGraph.scheduleRefresh();
    }
  });

  // Refresh on mount / tab activation
  $effect(() => {
    depGraph.onTabActive();
    depGraph.scheduleRefresh();
  });

  // Apply highlight state to flow nodes
  let displayNodes = $derived.by((): Node<DepGraphNodeData>[] => {
    if (!depGraph.focusedNodeId) return depGraph.flowNodes;

    const up = depGraph.upstreamIds;
    const down = depGraph.downstreamIds;
    const focused = depGraph.focusedNodeId;

    return depGraph.flowNodes.map((n) => {
      let highlight: DepGraphNodeData['highlight'] = 'unrelated';
      if (n.id === focused) highlight = 'focused';
      else if (up.has(n.id)) highlight = 'upstream';
      else if (down.has(n.id)) highlight = 'downstream';

      if (n.data.highlight === highlight) return n;
      return { ...n, data: { ...n.data, highlight } };
    });
  });

  let isEmpty = $derived(!depGraph.computing && (depGraph.data?.nodes.length ?? 0) === 0);
  let hasCycle = $derived(depGraph.data?.hasCycle ?? false);
</script>

<div class="dep-graph-container">
  {#if hasCycle}
    <div class="cycle-banner">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <span>Circular dependency detected. Terraform will fail to plan. Check resource references.</span>
    </div>
  {/if}

  {#if isEmpty}
    <div class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.4">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 12h8M12 8v8" />
      </svg>
      <p>Add resources and connect them to see the dependency graph.</p>
    </div>
  {:else}
    <div class="dep-graph-viewport">
      <SvelteFlow
        nodes={displayNodes}
        edges={depGraph.flowEdges}
        {nodeTypes}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
        minZoom={0.1}
        maxZoom={2}
      >
        <Controls showLock={false} />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
      </SvelteFlow>
    </div>
  {/if}

  {#if depGraph.computing}
    <div class="computing-overlay">
      <span>Computing dependencies...</span>
    </div>
  {/if}
</div>

<style>
  .dep-graph-container {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .dep-graph-viewport {
    flex: 1;
    min-height: 0;
  }

  .cycle-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(239, 68, 68, 0.15);
    border-bottom: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
    font-size: var(--font-12);
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--color-text-muted);
    font-size: var(--font-13);
  }

  .computing-overlay {
    position: absolute;
    top: 8px;
    right: 8px;
    padding: 4px 10px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    font-size: var(--font-11);
    color: var(--color-text-muted);
  }
</style>
