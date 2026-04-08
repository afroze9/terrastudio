<script lang="ts">
  import {
    SvelteFlow,
    SvelteFlowProvider,
    Background,
    BackgroundVariant,
    type Node,
    type Edge,
  } from '@xyflow/svelte';
  import { buildNodeTypes, edgeTypes } from '$lib/bootstrap';
  import { ui } from '$lib/stores/ui.svelte';
  import type { DiffableSnapshot, DiagramDiff } from '$lib/services/diff-engine';
  import type { ResourceNodeData } from '@terrastudio/types';

  interface Bounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }

  interface Props {
    snapshot: DiffableSnapshot;
    diff: DiagramDiff;
    side: 'before' | 'after';
    /** Shared bounding box so both canvases fitView to the same area */
    bounds: Bounds;
  }

  const { snapshot, diff, side, bounds }: Props = $props();

  const nodeTypes = buildNodeTypes();

  // Build a set of node IDs by diff status
  const addedIds = $derived(new Set(diff.resources.filter((r) => r.type === 'added').map((r) => r.nodeId)));
  const removedIds = $derived(new Set(diff.resources.filter((r) => r.type === 'removed').map((r) => r.nodeId)));
  const modifiedIds = $derived(new Set(diff.resources.filter((r) => r.type === 'modified').map((r) => r.nodeId)));

  // Convert snapshot nodes to SvelteFlow nodes with diff styling,
  // plus invisible anchor nodes at the shared bounding box corners
  const nodes = $derived.by((): Node[] => {
    const result: Node[] = snapshot.nodes.map((n) => {
      let diffStatus: 'added' | 'removed' | 'modified' | 'unchanged' = 'unchanged';
      if (addedIds.has(n.id)) diffStatus = 'added';
      else if (removedIds.has(n.id)) diffStatus = 'removed';
      else if (modifiedIds.has(n.id)) diffStatus = 'modified';

      return {
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
        parentId: n.parentId,
        width: n.width,
        height: n.height,
        style: buildDiffStyle(diffStatus),
        draggable: false,
        selectable: false,
        connectable: false,
      } as Node;
    });

    // Add invisible anchor nodes at shared bounds corners so fitView
    // produces the same viewport on both canvases
    result.push({
      id: '_diff_anchor_tl',
      type: undefined as unknown as string,
      position: { x: bounds.minX, y: bounds.minY },
      data: {},
      style: 'width:1px;height:1px;opacity:0;pointer-events:none;',
      draggable: false,
      selectable: false,
      connectable: false,
    });
    result.push({
      id: '_diff_anchor_br',
      type: undefined as unknown as string,
      position: { x: bounds.maxX, y: bounds.maxY },
      data: {},
      style: 'width:1px;height:1px;opacity:0;pointer-events:none;',
      draggable: false,
      selectable: false,
      connectable: false,
    });

    return result;
  });

  const edges = $derived.by((): Edge[] => {
    return snapshot.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      data: e.data,
      selectable: false,
      animated: false,
    })) as Edge[];
  });

  function buildDiffStyle(status: 'added' | 'removed' | 'modified' | 'unchanged'): string {
    switch (status) {
      case 'added':
        return 'outline: 2px solid #4ec96b; outline-offset: 2px; opacity: 1;';
      case 'removed':
        return 'outline: 2px solid #ff5050; outline-offset: 2px; opacity: 0.6;';
      case 'modified':
        return 'outline: 2px solid #e8a838; outline-offset: 2px; opacity: 1;';
      case 'unchanged':
        return 'opacity: 0.4;';
    }
  }
</script>

<div class="diff-canvas">
  <SvelteFlowProvider>
    <SvelteFlow
      {nodes}
      {edges}
      {nodeTypes}
      {edgeTypes}
      colorMode={ui.theme}
      fitView
      minZoom={0.05}
      maxZoom={2}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnDrag
      zoomOnScroll
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
    </SvelteFlow>
  </SvelteFlowProvider>
</div>

<style>
  .diff-canvas {
    flex: 1;
    height: 100%;
    min-width: 0;
  }
</style>
