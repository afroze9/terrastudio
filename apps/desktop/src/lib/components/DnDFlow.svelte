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
    type IsValidConnection,
  } from '@xyflow/svelte';
  import { diagram, type DiagramNode } from '$lib/stores/diagram.svelte';
  import { registry, edgeValidator } from '$lib/bootstrap';
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
  function findContainerAtPosition(
    flowX: number,
    flowY: number,
    childTypeId: ResourceTypeId,
    excludeNodeId?: string,
  ): string | undefined {
    const childSchema = registry.getResourceSchema(childTypeId);
    const allowedParents = childSchema?.canBeChildOf;
    if (!allowedParents || allowedParents.length === 0) return undefined;

    let bestMatch: string | undefined;
    let bestDepth = -1;

    for (const node of diagram.nodes) {
      if (node.id === excludeNodeId) continue;
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
        // Larger defaults for higher-level containers
        const sizeMap: Record<string, { w: number; h: number }> = {
          'azurerm/core/subscription': { w: 900, h: 700 },
          'azurerm/core/resource_group': { w: 800, h: 600 },
          'azurerm/networking/virtual_network': { w: 600, h: 400 },
          'azurerm/networking/subnet': { w: 350, h: 250 },
        };
        const { w, h } = sizeMap[schema.typeId] ?? { w: 350, h: 200 };
        newNode.width = w;
        newNode.height = h;
        newNode.style = `width: ${w}px; height: ${h}px;`;
      }

      if (parentId) {
        newNode.parentId = parentId;
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
    // Include sourceHandle in ID to support multiple outputs from same source to same target
    const edgeId = `e-${connection.source}-${connection.sourceHandle ?? 'default'}-${connection.target}`;

    // Look up the connection rule to get the default edge label
    const sourceNode = diagram.nodes.find((n) => n.id === connection.source);
    const targetNode = diagram.nodes.find((n) => n.id === connection.target);
    let label: string | undefined;
    let isBinding = false;
    if (sourceNode && targetNode) {
      const result = edgeValidator.validate(
        sourceNode.type as ResourceTypeId,
        connection.sourceHandle ?? '',
        targetNode.type as ResourceTypeId,
        connection.targetHandle ?? '',
      );
      if (result.valid && result.rule?.label) {
        label = result.rule.label;
      }
      if (result.valid && result.rule?.outputBinding) {
        isBinding = true;
        // Enhance label with source output definition
        const sourceSchema = registry.getResourceSchema(sourceNode.type as ResourceTypeId);
        const outputDef = sourceSchema?.outputs?.find(
          (o) => o.key === result.rule!.outputBinding!.sourceAttribute,
        );
        if (outputDef) {
          label = `Store ${outputDef.label} as secret`;
        }
      }
    }

    diagram.addEdge({
      id: edgeId,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      ...(label ? { label } : {}),
      ...(isBinding ? { animated: true } : {}),
    });
  };

  const isValidConnection: IsValidConnection = (connection) => {
    const sourceNode = diagram.nodes.find((n) => n.id === connection.source);
    const targetNode = diagram.nodes.find((n) => n.id === connection.target);
    if (!sourceNode || !targetNode) return false;

    const result = edgeValidator.validate(
      sourceNode.type as ResourceTypeId,
      connection.sourceHandle ?? '',
      targetNode.type as ResourceTypeId,
      connection.targetHandle ?? '',
    );
    return result.valid;
  };

  const onDelete: OnDelete = ({ nodes: deletedNodes }) => {
    for (const node of deletedNodes) {
      diagram.removeNode(node.id);
    }
  };

  /**
   * Handle node drag stop: reparent nodes based on their final position.
   * Allows dragging nodes into, out of, and between containers.
   */
  function handleNodeDragStop({ targetNode }: { targetNode: DiagramNode | null; nodes: DiagramNode[]; event: MouseEvent | TouchEvent }) {
    if (!targetNode) return;
    const draggedNode = targetNode;
    const schema = registry.getResourceSchema(draggedNode.type as ResourceTypeId);
    if (!schema) return;

    // Compute the dragged node's absolute position
    const absPos = getAbsolutePosition(draggedNode.id);

    // Find the deepest valid container at this position (excluding self)
    const newParentId = findContainerAtPosition(absPos.x, absPos.y, schema.typeId, draggedNode.id);
    const currentParentId = draggedNode.parentId as string | undefined;

    // If parent hasn't changed, nothing to do
    if (newParentId === currentParentId) return;

    diagram.nodes = diagram.nodes.map((n) => {
      if (n.id !== draggedNode.id) return n;

      if (newParentId) {
        // Moving into (or between) containers — position relative to new parent
        const parentAbs = getAbsolutePosition(newParentId);
        return {
          ...n,
          parentId: newParentId,
          position: {
            x: absPos.x - parentAbs.x,
            y: absPos.y - parentAbs.y,
          },
        };
      } else {
        // Moving out of container — position becomes absolute
        const { parentId: _pid, extent: _ext, ...rest } = n as any;
        return {
          ...rest,
          position: absPos,
        };
      }
    });
  }
</script>

<div class="dnd-flow-wrapper" use:dndHandler>
  <SvelteFlow
    bind:nodes={diagram.nodes}
    bind:edges={diagram.edges}
    {nodeTypes}
    fitView
    {isValidConnection}
    onconnect={onConnect}
    ondelete={onDelete}
    onnodedragstop={(event) => { handleNodeDragStop(event); diagram.saveSnapshot(); }}
    onnodeclick={({ node }) => { diagram.selectedEdgeId = null; diagram.selectedNodeId = node.id; }}
    onedgeclick={({ edge }) => { diagram.selectedNodeId = null; diagram.selectedEdgeId = edge.id; }}
    onpaneclick={() => { diagram.selectedNodeId = null; diagram.selectedEdgeId = null; }}
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
