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

  let { nodeTypes }: { nodeTypes: Record<string, ResourceNodeComponent> } = $props();

  const { screenToFlowPosition } = useSvelteFlow();

  function onDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  function onDrop(event: DragEvent) {
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

    diagram.addNode({
      id,
      type: schema.typeId,
      position,
      data: nodeData,
    });
  }

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

<SvelteFlow
  nodes={diagram.nodes}
  edges={diagram.edges}
  {nodeTypes}
  fitView
  ondragover={onDragOver}
  ondrop={onDrop}
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
