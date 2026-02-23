<script lang="ts">
  import {
    SvelteFlow,
    useSvelteFlow,
    Controls,
    ControlButton,
    MiniMap,
    Background,
    BackgroundVariant,
    SelectionMode,
    type OnConnect,
    type OnDelete,
    type IsValidConnection,
  } from '@xyflow/svelte';
  import { diagram, type DiagramNode } from '$lib/stores/diagram.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import { registry, edgeValidator } from '$lib/bootstrap';
  import {
    createNodeData, generateNodeId, nextAvailableCidr,
    applyNamingTemplate, buildTokens, sanitizeTerraformName, generateUniqueTerraformName,
  } from '@terrastudio/core';
  import { project } from '$lib/stores/project.svelte';
  import type { ResourceNodeComponent, ResourceTypeId } from '@terrastudio/types';
  import type { Action } from 'svelte/action';
  import { untrack } from 'svelte';

  let { nodeTypes }: { nodeTypes: Record<string, ResourceNodeComponent> } = $props();

  const { screenToFlowPosition, fitView } = useSvelteFlow();

  // Expose fitView globally so toolbar / menu bar can trigger it
  $effect(() => {
    ui.fitView = () => fitView();
    return () => { ui.fitView = null; };
  });

  // When edge type changes, update all existing edges
  $effect(() => {
    const type = ui.edgeType;
    untrack(() => {
      diagram.edges = diagram.edges.map((e) => ({ ...e, type }));
    });
  });

  let defaultEdgeOptions = $derived({ type: ui.edgeType });

  // ── Context menu state ───────────────────────────────────────────
  let contextMenu = $state<{
    x: number;
    y: number;
    nodeId?: string;
    edgeId?: string;
  } | null>(null);

  function closeContextMenu() { contextMenu = null; }

  function handleContextCopy() {
    const ids = diagram.nodes.filter((n) => n.selected).map((n) => n.id);
    if (contextMenu?.nodeId && !ids.includes(contextMenu.nodeId)) {
      ids.push(contextMenu.nodeId);
    }
    if (ids.length > 0) diagram.copyNodes(ids);
    closeContextMenu();
  }

  function handleContextDuplicate() {
    handleContextCopy();
    diagram.pasteNodes();
  }

  function handleContextPaste() {
    diagram.pasteNodes();
    closeContextMenu();
  }

  function handleContextDelete() {
    if (contextMenu?.edgeId) {
      diagram.removeEdge(contextMenu.edgeId);
    } else {
      const hasSelected = diagram.nodes.some((n) => n.selected);
      if (hasSelected) {
        diagram.confirmAndRemoveSelectedNodes();
      } else if (contextMenu?.nodeId) {
        diagram.confirmAndRemoveNode(contextMenu.nodeId);
      }
    }
    closeContextMenu();
  }

  function handleContextSelectAll() {
    diagram.selectAll();
    closeContextMenu();
  }

  function handleContextFitView() {
    ui.fitView?.();
    closeContextMenu();
  }

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

  /**
   * Compute the next available /24 CIDR for a subnet within a VNet.
   * Returns null if the parent is not a VNet or its address space is empty.
   */
  function computeAutoSubnetCidr(parentId: string): string | null {
    const parentNode = diagram.nodes.find((n) => n.id === parentId);
    if (!parentNode || parentNode.type !== 'azurerm/networking/virtual_network') return null;

    const addressSpace = parentNode.data.properties?.address_space as string[] | undefined;
    if (!addressSpace?.length) return null;

    // Collect CIDRs from all existing sibling subnets
    const usedCidrs = diagram.nodes
      .filter((n) => n.parentId === parentId && n.type === 'azurerm/networking/subnet')
      .flatMap((n) => (n.data.properties?.address_prefixes as string[]) ?? []);

    return nextAvailableCidr(addressSpace[0], usedCidrs);
  }

  /**
   * Check if dropping childTypeId at the given position would land on an
   * invalid container (the deepest container under the cursor doesn't accept it).
   */
  function isDropBlocked(flowX: number, flowY: number, childTypeId: ResourceTypeId, excludeNodeId?: string): boolean {
    const allowedParents = registry.getResourceSchema(childTypeId)?.canBeChildOf ?? [];
    if (allowedParents.length === 0) return false; // No parent constraints — always OK

    let deepestType: ResourceTypeId | undefined;
    let deepestDepth = -1;

    for (const node of diagram.nodes) {
      if (node.id === excludeNodeId) continue;
      const nodeSchema = registry.getResourceSchema(node.type as ResourceTypeId);
      if (!nodeSchema?.isContainer) continue;

      const abs = getAbsolutePosition(node.id);
      const nw = node.measured?.width ?? (node.width as number | undefined) ?? 250;
      const nh = node.measured?.height ?? (node.height as number | undefined) ?? 150;

      if (flowX >= abs.x && flowX <= abs.x + nw && flowY >= abs.y && flowY <= abs.y + nh) {
        let depth = 0;
        let pid = node.parentId as string | undefined;
        while (pid) {
          depth++;
          pid = diagram.nodes.find((n) => n.id === pid)?.parentId as string | undefined;
        }
        if (depth > deepestDepth) {
          deepestDepth = depth;
          deepestType = node.type as ResourceTypeId;
        }
      }
    }

    if (!deepestType) return false; // Not over any container
    return !allowedParents.includes(deepestType);
  }

  /**
   * Compute drag feedback: which containers are valid/invalid drop targets
   * for a given resource type at a given flow position.
   */
  function updateDragFeedback(flowX: number, flowY: number, childTypeId: ResourceTypeId, excludeNodeId?: string) {
    const childSchema = registry.getResourceSchema(childTypeId);
    const allowedParents = childSchema?.canBeChildOf ?? [];

    const validContainerIds = new Set<string>();
    const invalidContainerIds = new Set<string>();

    for (const node of diagram.nodes) {
      if (node.id === excludeNodeId) continue;
      const nodeSchema = registry.getResourceSchema(node.type as ResourceTypeId);
      if (!nodeSchema?.isContainer) continue;

      const abs = getAbsolutePosition(node.id);
      const nw = node.measured?.width ?? (node.width as number | undefined) ?? 250;
      const nh = node.measured?.height ?? (node.height as number | undefined) ?? 150;

      // Only highlight containers the cursor is currently over
      if (flowX >= abs.x && flowX <= abs.x + nw && flowY >= abs.y && flowY <= abs.y + nh) {
        if (allowedParents.includes(node.type as ResourceTypeId)) {
          validContainerIds.add(node.id);
        } else {
          invalidContainerIds.add(node.id);
        }
      }
    }

    // Remove valid ancestors from invalid set (if cursor is over both parent and grandparent)
    // and remove invalid containers that are parents of a valid one (the valid child "wins")
    ui.dragFeedback = { typeId: childTypeId, validContainerIds, invalidContainerIds };
  }

  function clearDragFeedback() {
    ui.dragFeedback = null;
  }

  const dndHandler: Action = (node) => {
    function handleDragOver(event: DragEvent) {
      event.preventDefault();
      if (!event.dataTransfer) return;

      const typeId = event.dataTransfer.getData('application/terrastudio-type');
      if (typeId) {
        const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        const blocked = isDropBlocked(position.x, position.y, typeId as ResourceTypeId);
        event.dataTransfer.dropEffect = blocked ? 'none' : 'move';
        updateDragFeedback(position.x, position.y, typeId as ResourceTypeId);
      }
    }

    function handleDrop(event: DragEvent) {
      event.preventDefault();
      clearDragFeedback();
      if (!event.dataTransfer) return;

      const typeId = event.dataTransfer.getData('application/terrastudio-type');
      if (!typeId) return;

      const schema = registry.getResourceSchema(typeId as `${string}/${string}/${string}`);
      if (!schema) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Block drop if cursor is over an invalid container
      if (isDropBlocked(position.x, position.y, schema.typeId)) return;

      const nodeData = createNodeData(schema);
      const id = generateNodeId(schema.typeId);

      // Apply naming convention if active
      const convention = project.projectConfig.namingConvention;
      if (convention?.enabled && schema.cafAbbreviation) {
        const instanceCount = diagram.nodes.filter(n => n.data.typeId === schema.typeId).length + 1;
        const defaultSlug = String(instanceCount).padStart(2, '0');
        const tokens = buildTokens(convention, schema.cafAbbreviation, defaultSlug);
        const fullName = applyNamingTemplate(convention.template, tokens, schema.namingConstraints);
        if (fullName) {
          nodeData.properties['name'] = fullName;
          nodeData.label = fullName;
          nodeData.terraformName = generateUniqueTerraformName(
            sanitizeTerraformName(fullName) || nodeData.terraformName,
            new Set(diagram.nodes.map(n => n.data.terraformName)),
          );
        }
      }

      // Check if dropped inside a container node
      const parentId = findContainerAtPosition(position.x, position.y, schema.typeId);

      // Auto-assign subnet CIDR when dropped into a VNet
      if (parentId && schema.typeId === 'azurerm/networking/subnet') {
        const autoCidr = computeAutoSubnetCidr(parentId);
        if (autoCidr) {
          nodeData.properties.address_prefixes = [autoCidr];
        }
      }

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
          'azurerm/compute/app_service_plan': { w: 400, h: 300 },
          'azurerm/storage/storage_account': { w: 400, h: 300 },
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

    function handleDragLeave() {
      clearDragFeedback();
    }

    // Capture phase so handlers fire before SvelteFlow's internal pane
    node.addEventListener('dragover', handleDragOver, { capture: true });
    node.addEventListener('drop', handleDrop, { capture: true });
    node.addEventListener('dragleave', handleDragLeave);

    return {
      destroy() {
        node.removeEventListener('dragover', handleDragOver, { capture: true });
        node.removeEventListener('drop', handleDrop, { capture: true });
        node.removeEventListener('dragleave', handleDragLeave);
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

  // Track pre-drag positions so we can snap back if dropped on an invalid container
  let dragStartPositions = new Map<string, { x: number; y: number }>();

  /**
   * Capture starting positions of all dragged nodes before the drag begins.
   */
  function handleNodeDragStart({ nodes: draggedNodes }: { targetNode: DiagramNode | null; nodes: DiagramNode[]; event: MouseEvent | TouchEvent }) {
    dragStartPositions.clear();
    for (const node of draggedNodes) {
      dragStartPositions.set(node.id, { x: node.position.x, y: node.position.y });
    }
  }

  /**
   * During node drag, update drag feedback to highlight valid/invalid containers.
   */
  function handleNodeDrag({ targetNode }: { targetNode: DiagramNode | null; nodes: DiagramNode[]; event: MouseEvent | TouchEvent }) {
    if (!targetNode) return;
    const absPos = getAbsolutePosition(targetNode.id);
    updateDragFeedback(absPos.x, absPos.y, targetNode.type as ResourceTypeId, targetNode.id);
  }

  /**
   * Handle node drag stop: reparent nodes based on their final position.
   * Allows dragging nodes into, out of, and between containers.
   */
  function handleNodeDragStop({ targetNode }: { targetNode: DiagramNode | null; nodes: DiagramNode[]; event: MouseEvent | TouchEvent }) {
    clearDragFeedback();
    if (!targetNode) return;
    const draggedNode = targetNode;
    const schema = registry.getResourceSchema(draggedNode.type as ResourceTypeId);
    if (!schema) return;

    // Compute the dragged node's absolute position
    const absPos = getAbsolutePosition(draggedNode.id);

    // If dropped on an invalid container, snap back to starting position
    if (isDropBlocked(absPos.x, absPos.y, schema.typeId, draggedNode.id)) {
      diagram.nodes = diagram.nodes.map((n) => {
        const startPos = dragStartPositions.get(n.id);
        return startPos ? { ...n, position: startPos } : n;
      });
      dragStartPositions.clear();
      return;
    }
    dragStartPositions.clear();

    // Find the deepest valid container at this position (excluding self)
    const newParentId = findContainerAtPosition(absPos.x, absPos.y, schema.typeId, draggedNode.id);
    const currentParentId = draggedNode.parentId as string | undefined;

    // If parent hasn't changed, nothing to do
    if (newParentId === currentParentId) return;

    // Auto-assign subnet CIDR when reparented into a new VNet
    let updatedProperties: Record<string, unknown> | undefined;
    if (newParentId && schema.typeId === 'azurerm/networking/subnet') {
      const autoCidr = computeAutoSubnetCidr(newParentId);
      if (autoCidr) {
        updatedProperties = { ...draggedNode.data.properties, address_prefixes: [autoCidr] };
      }
    }

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
          ...(updatedProperties ? { data: { ...n.data, properties: updatedProperties } } : {}),
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

    bringToFront(draggedNode.id);
  }

  /**
   * Move a node and all its descendants to the end of the nodes array
   * so they render on top of sibling containers in the same parent.
   */
  function bringToFront(nodeId: string) {
    const descendantIds = new Set<string>([nodeId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const n of diagram.nodes) {
        if (n.parentId && descendantIds.has(n.parentId as string) && !descendantIds.has(n.id)) {
          descendantIds.add(n.id);
          changed = true;
        }
      }
    }
    const others = diagram.nodes.filter((n) => !descendantIds.has(n.id));
    const moved = diagram.nodes.filter((n) => descendantIds.has(n.id));
    diagram.nodes = [...others, ...moved];
  }
</script>

<div class="dnd-flow-wrapper" use:dndHandler>
  <SvelteFlow
    bind:nodes={diagram.nodes}
    bind:edges={diagram.edges}
    {nodeTypes}
    {defaultEdgeOptions}
    colorMode={ui.theme}
    fitView
    minZoom={0.1}
    maxZoom={2}
    snapGrid={ui.snapToGrid ? [ui.gridSize, ui.gridSize] : undefined}
    selectionOnDrag
    panOnDrag={[1]}
    panActivationKey=" "
    selectionMode={SelectionMode.Full}
    {isValidConnection}
    onconnect={onConnect}
    ondelete={onDelete}
    onnodedragstart={(event) => { contextMenu = null; handleNodeDragStart(event); }}
    onnodedrag={handleNodeDrag}
    onnodedragstop={(event) => { handleNodeDragStop(event); diagram.saveSnapshot(); }}
    onnodeclick={({ node }) => { contextMenu = null; diagram.selectedEdgeId = null; diagram.selectedNodeId = node.id; }}
    onedgeclick={({ edge }) => { contextMenu = null; diagram.selectedNodeId = null; diagram.selectedEdgeId = edge.id; }}
    onpaneclick={() => { contextMenu = null; diagram.selectedNodeId = null; diagram.selectedEdgeId = null; }}
    onnodecontextmenu={({ event, node }) => { event.preventDefault(); contextMenu = { x: event.clientX, y: event.clientY, nodeId: node.id }; }}
    onselectioncontextmenu={({ event, nodes: selNodes }) => { event.preventDefault(); contextMenu = { x: event.clientX, y: event.clientY, nodeId: selNodes[0]?.id }; }}
    onedgecontextmenu={({ event, edge }) => { event.preventDefault(); contextMenu = { x: event.clientX, y: event.clientY, edgeId: edge.id }; }}
    onpanecontextmenu={({ event }) => { event.preventDefault(); contextMenu = { x: event.clientX, y: event.clientY }; }}
  >
    <Controls>
      <ControlButton
        onclick={() => ui.setShowMinimap(!ui.showMinimap)}
        title={ui.showMinimap ? 'Hide Minimap' : 'Show Minimap'}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style={ui.showMinimap ? 'opacity:1' : 'opacity:0.4'}>
          <rect x="1" y="1" width="14" height="14" rx="1.5" />
          <rect x="3" y="3" width="5" height="4" rx="0.5" fill="currentColor" stroke="none" opacity="0.6" />
          <rect x="3" y="9" width="3" height="2" rx="0.5" fill="currentColor" stroke="none" opacity="0.4" />
          <rect x="9" y="6" width="4" height="5" rx="0.5" fill="currentColor" stroke="none" opacity="0.4" />
        </svg>
      </ControlButton>
    </Controls>
    {#if ui.showMinimap}<MiniMap />{/if}
    <Background variant={BackgroundVariant.Dots} gap={ui.gridSize} size={1} />
  </SvelteFlow>
</div>

<!-- Escape key closes context menu -->
<svelte:window onkeydown={(e) => { if (e.key === 'Escape') contextMenu = null; }} />

{#if contextMenu}
  <!-- Invisible backdrop to close menu on click outside -->
  <button class="context-backdrop" onclick={closeContextMenu} aria-label="Close menu"></button>
  <div class="context-menu" style="left: {contextMenu.x}px; top: {contextMenu.y}px;">
    {#if contextMenu.nodeId}
      <button class="context-menu-item" onclick={handleContextCopy}>
        <span>Copy</span><span class="ctx-shortcut">Ctrl+C</span>
      </button>
      <button class="context-menu-item" onclick={handleContextDuplicate}>
        <span>Duplicate</span><span class="ctx-shortcut">Ctrl+D</span>
      </button>
      <div class="context-menu-separator"></div>
      <button class="context-menu-item" onclick={handleContextSelectAll}>
        <span>Select All</span><span class="ctx-shortcut">Ctrl+A</span>
      </button>
      <div class="context-menu-separator"></div>
      <button class="context-menu-item context-menu-danger" onclick={handleContextDelete}>
        <span>Delete</span><span class="ctx-shortcut">Del</span>
      </button>
    {:else if contextMenu.edgeId}
      <button class="context-menu-item context-menu-danger" onclick={handleContextDelete}>
        <span>Delete Edge</span><span class="ctx-shortcut">Del</span>
      </button>
    {:else}
      <button class="context-menu-item" onclick={handleContextPaste} disabled={!diagram.hasClipboard}>
        <span>Paste</span><span class="ctx-shortcut">Ctrl+V</span>
      </button>
      <div class="context-menu-separator"></div>
      <button class="context-menu-item" onclick={handleContextSelectAll}>
        <span>Select All</span><span class="ctx-shortcut">Ctrl+A</span>
      </button>
      <button class="context-menu-item" onclick={handleContextFitView}>
        <span>Fit View</span>
      </button>
    {/if}
  </div>
{/if}

<style>
  .dnd-flow-wrapper {
    width: 100%;
    height: 100%;
  }

  /* Context menu */
  .context-backdrop {
    position: fixed;
    inset: 0;
    z-index: 999;
    background: transparent;
    border: none;
    cursor: default;
  }
  .context-menu {
    position: fixed;
    z-index: 1000;
    min-width: 170px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 4px 0;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
  .context-menu-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 6px 12px;
    border: none;
    background: none;
    color: var(--color-text);
    font-size: 12px;
    cursor: pointer;
    text-align: left;
  }
  .context-menu-item:hover:not(:disabled) {
    background: var(--color-surface-hover);
  }
  .context-menu-item:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .context-menu-danger:hover:not(:disabled) {
    color: #ef4444;
  }
  .ctx-shortcut {
    font-size: 11px;
    color: var(--color-text-muted);
    margin-left: 24px;
  }
  .context-menu-separator {
    height: 1px;
    background: var(--color-border);
    margin: 4px 0;
  }
</style>
