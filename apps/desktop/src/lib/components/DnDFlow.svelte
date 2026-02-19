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
   * Compute absolute position for a node by walking up the parent chain.
   */
  function getAbsolutePosition(nodeId: string): { x: number; y: number } {
    let x = 0;
    let y = 0;
    let currentId: string | undefined = nodeId;

    while (currentId) {
      const node = diagram.nodes.find((n) => n.id === currentId);
      if (!node) break;
      x += node.position.x;
      y += node.position.y;
      currentId = node.parentId as string | undefined;
    }

    return { x, y };
  }

  /**
   * Find the deepest container at a given flow position that accepts childTypeId.
   * Uses canBeChildOf on the child schema to check compatibility.
   */
  function findContainerAtPosition(flowX: number, flowY: number, childTypeId: ResourceTypeId): string | undefined {
    const childSchema = registry.getResourceSchema(childTypeId);
    const allowedParents = childSchema?.canBeChildOf;
    if (!allowedParents || allowedParents.length === 0) return undefined;

    let bestMatch: string | undefined;
    let bestDepth = -1;

    for (const node of diagram.nodes) {
      const nodeTypeId = node.type as ResourceTypeId;
      if (!allowedParents.includes(nodeTypeId)) continue;

      const abs = getAbsolutePosition(node.id);
      const nw = node.measured?.width ?? (node.width as number | undefined) ?? 250;
      const nh = node.measured?.height ?? (node.height as number | undefined) ?? 150;

      if (flowX >= abs.x && flowX <= abs.x + nw && flowY >= abs.y && flowY <= abs.y + nh) {
        // Compute depth (deeper containers win)
        let depth = 0;
        let pid = node.parentId as string | undefined;
        while (pid) {
          depth++;
          pid = diagram.nodes.find((n) => n.id === pid)?.parentId as string | undefined;
        }
        if (depth > bestDepth) {
          bestDepth = depth;
          bestMatch = node.id;
        }
      }
    }

    return bestMatch;
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

      // If dropped in a container, position is relative to parent's absolute position
      let nodePosition = position;
      if (parentId) {
        const parentAbs = getAbsolutePosition(parentId);
        nodePosition = {
          x: position.x - parentAbs.x,
          y: position.y - parentAbs.y,
        };
      }

      const newNode: Record<string, unknown> = {
        id,
        type: schema.typeId,
        position: nodePosition,
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
