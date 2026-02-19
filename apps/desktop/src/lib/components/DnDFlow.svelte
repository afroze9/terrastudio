<script lang="ts">
  import {
    SvelteFlow,
    useSvelteFlow,
    Controls,
    MiniMap,
    Background,
    BackgroundVariant,
    type OnConnect,
    type OnDelete,
  } from '@xyflow/svelte';
  import { diagram } from '$lib/stores/diagram.svelte';
  import { registry } from '$lib/bootstrap';
  import { createNodeData, generateNodeId } from '@terrastudio/core';
  import type { ResourceNodeComponent } from '@terrastudio/types';
  import type { Action } from 'svelte/action';

  let { nodeTypes }: { nodeTypes: Record<string, ResourceNodeComponent> } = $props();

  const { screenToFlowPosition } = useSvelteFlow();

  /**
   * Svelte action that imperatively attaches dragover/drop listeners
   * to the DOM element. This bypasses any event delegation issues.
   */
  const dndHandler: Action = (node) => {
    function handleDragOver(event: DragEvent) {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
    }

    function handleDrop(event: DragEvent) {
      event.preventDefault();
      if (!event.dataTransfer) return;

      const typeId = event.dataTransfer.getData('application/terrastudio-type');
      console.log('[DnDFlow] drop received, typeId:', typeId);
      if (!typeId) return;

      const schema = registry.getResourceSchema(typeId as `${string}/${string}/${string}`);
      if (!schema) {
        console.warn('[DnDFlow] schema not found for typeId:', typeId);
        return;
      }

      const nodeData = createNodeData(schema);
      const id = generateNodeId(schema.typeId);

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      console.log('[DnDFlow] adding node:', id, 'at', position);
      diagram.addNode({
        id,
        type: schema.typeId,
        position,
        data: nodeData,
      });
    }

    // Use capture phase so our handlers fire BEFORE SvelteFlow's
    // internal pane can intercept/stop the drag events
    node.addEventListener('dragover', handleDragOver, { capture: true });
    node.addEventListener('drop', handleDrop, { capture: true });

    return {
      destroy() {
        node.removeEventListener('dragover', handleDragOver, { capture: true });
        node.removeEventListener('drop', handleDrop, { capture: true });
      },
    };
  };

  const onConnect: OnConnect = (connection) => {
    const edgeId = `e-${connection.source}-${connection.target}`;
    diagram.addEdge({
      id: edgeId,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
    });
  };

  const onDelete: OnDelete = ({ nodes: deletedNodes }) => {
    for (const node of deletedNodes) {
      diagram.removeNode(node.id);
    }
  };

  function onNodeClick(_event: MouseEvent | TouchEvent, node: { id: string }) {
    diagram.selectedNodeId = node.id;
  }

  function onPaneClick() {
    diagram.selectedNodeId = null;
  }
</script>

<div class="dnd-flow-wrapper" use:dndHandler>
  <SvelteFlow
    nodes={diagram.nodes}
    edges={diagram.edges}
    {nodeTypes}
    fitView
    onconnect={onConnect}
    ondelete={onDelete}
    onnodeclick={onNodeClick}
    onpaneclick={onPaneClick}
    onnodeschange={(changes) => {
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          diagram.nodes = diagram.nodes.map((n) =>
            n.id === change.id ? { ...n, position: change.position! } : n
          );
        }
      }
    }}
  >
    <Controls />
    <MiniMap />
    <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
  </SvelteFlow>
</div>

<style>
  .dnd-flow-wrapper {
    width: 100%;
    height: 100%;
  }
</style>
