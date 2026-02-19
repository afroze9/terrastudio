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
  import type { ResourceNodeComponent, ResourceTypeId } from '@terrastudio/types';
  import type { Action } from 'svelte/action';

  let { nodeTypes }: { nodeTypes: Record<string, ResourceNodeComponent> } = $props();

  const { screenToFlowPosition } = useSvelteFlow();

  /**
   * Find the container node at a given flow position, if any.
   * Returns the container's id if the drop position falls inside it.
   */
  function findContainerAtPosition(flowX: number, flowY: number, childTypeId: ResourceTypeId): string | undefined {
    for (const node of diagram.nodes) {
      const schema = registry.getResourceSchema(node.type as ResourceTypeId);
      if (!schema?.isContainer) continue;
      if (schema.acceptsChildren && !schema.acceptsChildren.includes(childTypeId)) continue;

      const nx = node.position.x;
      const ny = node.position.y;
      const nw = node.measured?.width ?? node.width ?? 250;
      const nh = node.measured?.height ?? node.height ?? 150;

      if (flowX >= nx && flowX <= nx + nw && flowY >= ny && flowY <= ny + nh) {
        return node.id;
      }
    }
    return undefined;
  }

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
      if (!typeId) return;

      const schema = registry.getResourceSchema(typeId as `${string}/${string}/${string}`);
      if (!schema) return;

      const nodeData = createNodeData(schema);
      const id = generateNodeId(schema.typeId);

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Check if dropped inside a container node
      const parentId = findContainerAtPosition(position.x, position.y, schema.typeId);

      // Container nodes need explicit dimensions for SvelteFlow parent-child
      const isContainer = schema.isContainer ?? false;

      const newNode: Record<string, unknown> = {
        id,
        type: schema.typeId,
        position: parentId
          ? { x: position.x - (diagram.nodes.find((n) => n.id === parentId)?.position.x ?? 0),
              y: position.y - (diagram.nodes.find((n) => n.id === parentId)?.position.y ?? 0) }
          : position,
        data: nodeData,
      };

      if (isContainer) {
        newNode.width = 350;
        newNode.height = 200;
        newNode.style = 'width: 350px; height: 200px;';
      }

      if (parentId) {
        newNode.parentId = parentId;
        newNode.extent = 'parent' as const;
      }

      diagram.addNode(newNode as any);
    }

    // Capture phase so handlers fire before SvelteFlow's internal pane
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
</script>

<div class="dnd-flow-wrapper" use:dndHandler>
  <SvelteFlow
    bind:nodes={diagram.nodes}
    bind:edges={diagram.edges}
    {nodeTypes}
    fitView
    onconnect={onConnect}
    ondelete={onDelete}
    onnodeclick={({ node }) => { diagram.selectedNodeId = node.id; }}
    onpaneclick={() => { diagram.selectedNodeId = null; }}
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
