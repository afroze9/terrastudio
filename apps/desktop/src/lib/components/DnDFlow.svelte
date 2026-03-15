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
    ViewportPortal,
    type OnConnect,
    type OnDelete,
    type IsValidConnection,
    type Edge,
  } from '@xyflow/svelte';
  import { diagram, type DiagramNode } from '$lib/stores/diagram.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import { registry, edgeTypes } from '$lib/bootstrap';
  import {
    createNodeData, generateNodeId, nextAvailableCidr,
    applyNamingTemplate, buildTokens, sanitizeTerraformName, generateUniqueTerraformName,
  } from '@terrastudio/core';
  import { project } from '$lib/stores/project.svelte';
  import type { ResourceNodeComponent, ResourceTypeId, EdgeCategoryId, TerraStudioEdgeData } from '@terrastudio/types';
  import type { Action } from 'svelte/action';
  import { tick, untrack } from 'svelte';
  import { EdgeMarkers } from './edges';
  import { autofitContainer } from '$lib/services/layout-service';
  import { getNamingOverridesFromAncestors } from '$lib/services/naming-overrides';
  import { connectionWizard } from '$lib/stores/connection-wizard.svelte';
  import { connectionUx, type GhostTarget } from '$lib/stores/connection-ux.svelte';
  import { buildEdgeWizardEntry, buildContainmentWizardEntry } from '$lib/services/connection-wizard-builder';
  import ConnectionPointsModal from './ConnectionPointsModal.svelte';
  import ModuleBoundary from './ModuleBoundary.svelte';
  import ModuleInstanceBoundary from './ModuleInstanceBoundary.svelte';
  import type { ConnectionPointConfig, HandlePositionOverrides, HandleDefinition, OutputDefinition, ResourceTypeId as TypeId } from '@terrastudio/types';

  let { nodeTypes }: { nodeTypes: Record<string, ResourceNodeComponent> } = $props();

  const { screenToFlowPosition, fitView, setCenter, getNode } = useSvelteFlow();

  // Expose fitView globally so toolbar / menu bar can trigger it
  $effect(() => {
    ui.fitView = () => fitView();
    return () => { ui.fitView = null; };
  });

  // Expose navigateFn for canvas search
  $effect(() => {
    ui.navigateFn = (nodeId: string) => {
      const node = getNode(nodeId);
      if (!node) return;

      const abs = getAbsolutePosition(nodeId);
      const x = abs.x + (node.measured?.width ?? 160) / 2;
      const y = abs.y + (node.measured?.height ?? 60) / 2;
      setCenter(x, y, { zoom: 1.2, duration: 400 });

      diagram.nodes = diagram.nodes.map((n) => ({ ...n, selected: n.id === nodeId }));
      diagram.selectedNodeId = nodeId;

      tick().then(() => {
        const el = document.querySelector(`[data-id="${nodeId}"]`);
        el?.classList.add('search-highlight-flash');
        setTimeout(() => el?.classList.remove('search-highlight-flash'), 1200);
      });
    };
    return () => { ui.navigateFn = null; };
  });

  // When edge type changes, update all existing edges
  $effect(() => {
    const type = ui.edgeType;
    untrack(() => {
      diagram.edges = diagram.edges.map((e) => ({ ...e, type }));
    });
  });

  // ── Reference edge display ──────────────────────────────────────────────
  // Merge real (persisted) edges with auto-generated reference edges.
  // $derived re-computes reactively whenever diagram.edges or diagram.nodes changes.
  // Build a set of collapsed module IDs and their member node IDs for edge redirection.
  const collapsedModuleMap = $derived.by(() => {
    const map = new Map<string, { syntheticId: string; memberIds: Set<string> }>();
    for (const mod of diagram.modules) {
      if (!mod.collapsed || mod.isTemplate) continue; // templates use instance-based visibility
      const memberIds = new Set(
        diagram.nodes.filter((n) => n.data.moduleId === mod.id).map((n) => n.id),
      );
      map.set(mod.id, { syntheticId: `_mod_${mod.id}`, memberIds });
    }
    return map;
  });

  // Build a set of template member node IDs — these are always hidden on canvas.
  // Edges involving original template members are filtered out (cloned instance members have their own edges).
  // Only original template nodes (never _instmem_ clones) are included.
  const hiddenTemplateMemberIds = $derived.by(() => {
    const ids = new Set<string>();
    for (const mod of diagram.modules) {
      if (!mod.isTemplate) continue;
      for (const n of diagram.nodes) {
        if (n.data.moduleId === mod.id && !n.id.startsWith('_instmem_')) ids.add(n.id);
      }
    }
    return ids;
  });

  // Type assertion to Edge[] for SvelteFlow compatibility (our TerraStudioEdgeData extends Record<string, unknown>).
  // Also filter out edges whose category is hidden via the visibility toggle.
  // Redirects cross-module edges to the synthetic collapsed node when a module is collapsed.
  // Hides edges involving hidden template members.
  const displayEdges = $derived.by(() => {
    const allEdges = [...diagram.edges, ...diagram.referenceEdges] as Edge[];
    const result: Edge[] = [];

    for (const edge of allEdges) {
      const category = (edge.data as TerraStudioEdgeData | undefined)?.category ?? 'structural';
      if (!ui.isEdgeCategoryVisible(category)) continue;

      // Hide edges involving hidden template member nodes
      if (hiddenTemplateMemberIds.size > 0) {
        if (hiddenTemplateMemberIds.has(edge.source) || hiddenTemplateMemberIds.has(edge.target)) {
          continue;
        }
      }

      if (collapsedModuleMap.size === 0) {
        result.push(edge);
        continue;
      }

      // Check if source or target is in a collapsed module
      let newSource = edge.source;
      let newTarget = edge.target;
      let newSourceHandle = edge.sourceHandle;
      let newTargetHandle = edge.targetHandle;
      let redirected = false;

      for (const [, { syntheticId, memberIds }] of collapsedModuleMap) {
        if (memberIds.has(edge.source) && memberIds.has(edge.target)) {
          // Both endpoints inside same collapsed module — hide edge
          redirected = true;
          newSource = ''; // signal to skip
          break;
        }
        if (memberIds.has(edge.source) && !memberIds.has(edge.target)) {
          newSource = syntheticId;
          newSourceHandle = `mod-out-${edge.source}-${edge.sourceHandle ?? 'default'}`;
          redirected = true;
        }
        if (memberIds.has(edge.target) && !memberIds.has(edge.source)) {
          newTarget = syntheticId;
          newTargetHandle = `mod-in-${edge.target}-${edge.targetHandle ?? 'default'}`;
          redirected = true;
        }
      }

      if (newSource === '') continue; // both inside collapsed module

      if (redirected) {
        result.push({
          ...edge,
          id: `${edge.id}-mod`,
          source: newSource,
          target: newTarget,
          sourceHandle: newSourceHandle,
          targetHandle: newTargetHandle,
          zIndex: 1001,
        });
      } else {
        result.push(edge);
      }
    }

    return result;
  });

  let defaultEdgeOptions = $derived({ type: ui.edgeType });

  // ── Space-to-pan: disable node dragging while space is held ──────
  let spaceHeld = $state(false);
  $effect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space' && !e.repeat) spaceHeld = true;
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') spaceHeld = false;
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  });

  // ── Context menu state ───────────────────────────────────────────
  let contextMenu = $state<{
    x: number;
    y: number;
    nodeId?: string;
    edgeId?: string;
  } | null>(null);

  function closeContextMenu() { contextMenu = null; }

  // ── Handle Manager Modal state ───────────────────────────────────
  let handleManagerModal = $state<{
    nodeId: string;
    nodeLabel: string;
    initialConnectionPoints: ConnectionPointConfig;
    initialHandlePositions: HandlePositionOverrides;
    schemaHandles: ReadonlyArray<HandleDefinition>;
    enabledOutputs: ReadonlyArray<OutputDefinition>;
  } | null>(null);

  function handleManageConnectionPoints() {
    const nodeId = contextMenu?.nodeId;
    if (!nodeId) return;
    const node = diagram.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const schema = registry.getResourceSchema(node.type as TypeId);
    const enabledOutputKeys = (node.data.enabledOutputs as string[]) ?? [];
    const enabledOutputs = (schema?.outputs ?? []).filter((o: OutputDefinition) => enabledOutputKeys.includes(o.key));

    // Build the list of schema-defined handles for the modal.
    // Also include synthetic handles for showAsEdge reference properties so users
    // can reposition those edge exit points (using the ref-{propKey} convention).
    const referenceHandles: HandleDefinition[] = (schema?.properties ?? [])
      .filter((p: { type: string; showAsEdge?: boolean }) => p.type === 'reference' && p.showAsEdge)
      .map((p: { key: string; label: string }) => ({
        id: `ref-${p.key}`,
        type: 'source' as const,
        position: 'right' as const,
        label: p.label,
      }));

    handleManagerModal = {
      nodeId: node.id,
      nodeLabel: node.data.label || 'Node',
      initialConnectionPoints: (node.data.connectionPoints as ConnectionPointConfig) ?? { top: 0, bottom: 0, left: 0, right: 0 },
      initialHandlePositions: (node.data.handlePositions as HandlePositionOverrides) ?? {},
      schemaHandles: [...(schema?.handles ?? []), ...referenceHandles],
      enabledOutputs,
    };
    closeContextMenu();
  }

  function handleSaveHandleManager(connectionPoints: ConnectionPointConfig, handlePositions: HandlePositionOverrides) {
    if (!handleManagerModal) return;
    const nodeId = handleManagerModal.nodeId;
    const oldConfig = handleManagerModal.initialConnectionPoints;

    // Remove edges attached to annotation handles that were removed
    const sides = ['top', 'bottom', 'left', 'right'] as const;
    for (const side of sides) {
      const oldCount = oldConfig[side] ?? 0;
      const newCount = connectionPoints[side] ?? 0;
      for (let i = newCount; i < oldCount; i++) {
        const removedSource = `cp-${side}-${i}-source`;
        const removedTarget = `cp-${side}-${i}-target`;
        const edgesToRemove = diagram.edges.filter(
          (e) =>
            (e.source === nodeId && (e.sourceHandle === removedSource || e.sourceHandle === removedTarget)) ||
            (e.target === nodeId && (e.targetHandle === removedSource || e.targetHandle === removedTarget))
        );
        for (const edge of edgesToRemove) {
          diagram.removeEdge(edge.id);
        }
      }
    }

    diagram.updateNodeData(nodeId, { connectionPoints, handlePositions });
    handleManagerModal = null;
  }

  function handleCloseHandleManager() {
    handleManagerModal = null;
  }

  function handleContextCopy() {
    const ids = diagram.nodes.filter((n) => n.selected).map((n) => n.id);
    if (contextMenu?.nodeId && !ids.includes(contextMenu.nodeId)) {
      ids.push(contextMenu.nodeId);
    }
    if (ids.length > 0) diagram.copyNodes(ids);
    closeContextMenu();
  }

  function handleContextDuplicate() {
    const ids = diagram.nodes.filter((n) => n.selected).map((n) => n.id);
    if (contextMenu?.nodeId && !ids.includes(contextMenu.nodeId)) {
      ids.push(contextMenu.nodeId);
    }
    diagram.duplicateNodes(ids);
    closeContextMenu();
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

  function handleContextFitToContents() {
    const nodeId = contextMenu?.nodeId;
    if (nodeId) autofitContainer(nodeId);
    closeContextMenu();
  }

  // ── Module context menu ─────────────────────────────────────────

  /** Whether the context shows "Create Module" — need 2+ selected nodes */
  let canCreateModule = $derived.by(() => {
    if (!contextMenu?.nodeId) return false;
    const selectedIds = diagram.nodes.filter((n) => n.selected).map((n) => n.id);
    if (!selectedIds.includes(contextMenu.nodeId)) selectedIds.push(contextMenu.nodeId);
    return selectedIds.length >= 2;
  });

  /** Whether context-menu node belongs to a module */
  let contextNodeModuleId = $derived.by(() => {
    const nodeId = contextMenu?.nodeId;
    if (!nodeId) return null;
    const node = diagram.nodes.find((n) => n.id === nodeId);
    return (node?.data.moduleId as string) ?? null;
  });

  let moduleNameInput = $state('');
  let showModuleNameDialog = $state(false);
  let pendingModuleNodeIds = $state<string[]>([]);

  function handleCreateModule() {
    const selectedIds = diagram.nodes.filter((n) => n.selected).map((n) => n.id);
    if (contextMenu?.nodeId && !selectedIds.includes(contextMenu.nodeId)) {
      selectedIds.push(contextMenu.nodeId);
    }
    pendingModuleNodeIds = selectedIds;
    moduleNameInput = '';
    showModuleNameDialog = true;
    closeContextMenu();
  }

  function confirmCreateModule() {
    const name = moduleNameInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (!name || pendingModuleNodeIds.length < 2) return;
    const moduleId = diagram.createModule(name, pendingModuleNodeIds);
    diagram.selectedModuleId = moduleId;
    showModuleNameDialog = false;
    pendingModuleNodeIds = [];
  }

  function handleRemoveFromModule() {
    const nodeId = contextMenu?.nodeId;
    if (nodeId) diagram.removeNodesFromModule([nodeId]);
    closeContextMenu();
  }

  // ── Template / Instance context menu ──────────────────────────

  /** Whether context-menu node belongs to a module that can be converted to template */
  let canConvertToTemplate = $derived.by(() => {
    if (!contextNodeModuleId) return false;
    const mod = diagram.modules.find((m) => m.id === contextNodeModuleId);
    return mod ? !mod.isTemplate : false;
  });

  /** Whether context-menu node belongs to a template module */
  let contextNodeIsInTemplate = $derived.by(() => {
    if (!contextNodeModuleId) return false;
    const mod = diagram.modules.find((m) => m.id === contextNodeModuleId);
    return mod?.isTemplate === true;
  });

  function handleConvertToTemplate() {
    if (contextNodeModuleId) {
      diagram.convertToTemplate(contextNodeModuleId);
    }
    closeContextMenu();
  }

  let instanceNameInput = $state('');
  let instanceNameError = $state('');
  let showInstanceNameDialog = $state(false);
  let pendingInstanceTemplateId = $state<string | null>(null);
  let pendingInstancePosition = $state<{ x: number; y: number } | null>(null);

  function handleCreateInstance(templateId?: string, position?: { x: number; y: number }) {
    const tid = templateId ?? contextNodeModuleId;
    if (!tid) return;
    pendingInstanceTemplateId = tid;
    pendingInstancePosition = position ?? null;
    instanceNameInput = '';
    instanceNameError = '';
    showInstanceNameDialog = true;
    closeContextMenu();
  }

  function confirmCreateInstance() {
    const name = instanceNameInput.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    if (!name || !pendingInstanceTemplateId) return;
    // Check uniqueness
    if (diagram.moduleInstances.some((i) => i.name === name)) {
      instanceNameError = `Name "${name}" is already in use`;
      return;
    }
    instanceNameError = '';
    diagram.createModuleInstance(pendingInstanceTemplateId, name, pendingInstancePosition ?? undefined);
    showInstanceNameDialog = false;
    pendingInstanceTemplateId = null;
    pendingInstancePosition = null;
  }

  /** Check if the context-menu node is a container with children */
  let contextNodeIsContainerWithChildren = $derived.by(() => {
    const nodeId = contextMenu?.nodeId;
    if (!nodeId) return false;
    const node = diagram.nodes.find((n) => n.id === nodeId);
    if (!node) return false;
    const schema = registry.getResourceSchema(node.type as ResourceTypeId);
    if (!schema?.isContainer) return false;
    return diagram.nodes.some((n) => n.parentId === nodeId);
  });

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
      if (node.hidden) continue;
      if (node.id.startsWith('_instmem_')) continue; // skip transient instance clones
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
   * Find the deepest container at a given flow position (for annotation nodes).
   * Unlike findContainerAtPosition, accepts ANY container regardless of canBeChildOf.
   */
  function findAnyContainerAtPosition(
    flowX: number,
    flowY: number,
    excludeNodeId?: string,
  ): string | undefined {
    let bestMatch: string | undefined;
    let bestDepth = -1;

    for (const node of diagram.nodes) {
      if (node.id === excludeNodeId) continue;
      if (node.hidden) continue;
      if (node.type === '_annotation_') continue;
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
      if (node.hidden) continue;
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
      if (node.hidden) continue;
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

      // Template instance drag — always allow drop (no containment rules)
      if (event.dataTransfer.types.includes('application/terrastudio-template')) {
        event.dataTransfer.dropEffect = 'copy';
        return;
      }

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

      // Handle template instance drop from palette
      const templateId = event.dataTransfer.getData('application/terrastudio-template');
      if (templateId) {
        const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        handleCreateInstance(templateId, position);
        return;
      }

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

      // Check if dropped inside a container node
      const parentId = findContainerAtPosition(position.x, position.y, schema.typeId);

      // Apply naming convention if active — store only the slug; name/label are computed
      const convention = project.projectConfig.namingConvention;
      if (convention?.enabled && schema.cafAbbreviation) {
        const instanceCount = diagram.nodes.filter(n => n.data.typeId === schema.typeId).length + 1;
        const defaultSlug = String(instanceCount).padStart(2, '0');
        // Walk up from drop container to collect naming token overrides from ancestor schemas.
        // Pass a synthetic node whose parentId points to the drop container so the walk
        // includes the container itself and all its ancestors.
        const rgOverrides = parentId
          ? getNamingOverridesFromAncestors(
              { id: '__drop__', parentId, position: { x: 0, y: 0 }, data: { typeId: schema.typeId, properties: {}, references: {}, terraformName: '', label: '', validationErrors: [] } },
              diagram.nodes,
              (typeId) => registry.getResourceSchema(typeId),
            )
          : {};
        const tokens = buildTokens(convention, schema.cafAbbreviation, defaultSlug, rgOverrides);
        const fullName = applyNamingTemplate(convention.template, tokens, schema.namingConstraints);
        nodeData.namingSlug = defaultSlug;
        if (fullName) {
          nodeData.terraformName = generateUniqueTerraformName(
            sanitizeTerraformName(fullName) || nodeData.terraformName,
            new Set(diagram.nodes.map(n => n.data.terraformName)),
          );
        }
      }

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
        // Use schema minSize scaled up for comfortable initial size, fallback to defaults
        const minW = schema.minSize?.width ?? 200;
        const minH = schema.minSize?.height ?? 120;
        const w = Math.max(minW * 2, 350);
        const h = Math.max(minH * 2, 200);
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
    const edgeId = `e-${connection.source}-${connection.sourceHandle ?? 'default'}-${connection.target}-${connection.targetHandle ?? 'default'}`;

    // Check if this is a connection between user-defined connection points (annotation edge)
    const isConnectionPointEdge =
      connection.sourceHandle?.startsWith('cp-') || connection.targetHandle?.startsWith('cp-');

    // Look up the connection rule to get the default edge label and category
    const sourceNode = diagram.nodes.find((n) => n.id === connection.source);
    const targetNode = diagram.nodes.find((n) => n.id === connection.target);
    let label: string | undefined;
    let category: EdgeCategoryId = isConnectionPointEdge ? 'annotation' : 'structural';
    let ruleMatch: TerraStudioEdgeData['ruleMatch'];

    if (sourceNode && targetNode && !isConnectionPointEdge) {
      const result = registry.edgeValidator.validate(
        sourceNode.type as ResourceTypeId,
        connection.sourceHandle ?? '',
        targetNode.type as ResourceTypeId,
        connection.targetHandle ?? '',
      );
      if (result.valid && result.rule) {
        label = result.rule.label;
        ruleMatch = {
          sourceType: result.rule.sourceType,
          targetType: result.rule.targetType,
          createsReference: result.rule.createsReference,
          outputBinding: result.rule.outputBinding,
        };

        if (result.rule.outputBinding) {
          category = 'binding';
          // Enhance label with source output definition
          const sourceSchema = registry.getResourceSchema(sourceNode.type as ResourceTypeId);
          const outputDef = sourceSchema?.outputs?.find(
            (o: OutputDefinition) => o.key === result.rule!.outputBinding!.sourceAttribute,
          );
          if (outputDef) {
            label = `Store ${outputDef.label} as secret`;
          }
        }
      }
    }

    diagram.addEdge({
      id: edgeId,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      data: {
        category,
        label,
        ruleMatch,
      },
    });

    // Notify connection wizard
    if (sourceNode && targetNode && !isConnectionPointEdge && ruleMatch) {
      const wizardRule = registry.edgeValidator.validate(
        sourceNode.type as ResourceTypeId,
        connection.sourceHandle ?? '',
        targetNode.type as ResourceTypeId,
        connection.targetHandle ?? '',
      );
      const wizardEntry = buildEdgeWizardEntry({
        edgeId,
        sourceNode,
        targetNode,
        rule: wizardRule.valid ? wizardRule.rule : undefined,
        registry,
      });
      if (wizardEntry) connectionWizard.notifyEdgeConnection(wizardEntry);
    }
  };

  const isValidConnection: IsValidConnection = (connection) => {
    const sourceNode = diagram.nodes.find((n) => n.id === connection.source);
    const targetNode = diagram.nodes.find((n) => n.id === connection.target);
    if (!sourceNode || !targetNode) return false;

    // Connection point handles (cp-*) can connect to any other connection point handle
    const isSourceCp = connection.sourceHandle?.startsWith('cp-');
    const isTargetCp = connection.targetHandle?.startsWith('cp-');
    if (isSourceCp && isTargetCp) {
      // Both ends are connection points - always valid for annotation edges
      return true;
    }
    if (isSourceCp || isTargetCp) {
      // One end is a connection point, other is not - invalid
      return false;
    }

    const result = registry.edgeValidator.validate(
      sourceNode.type as ResourceTypeId,
      connection.sourceHandle ?? '',
      targetNode.type as ResourceTypeId,
      connection.targetHandle ?? '',
    );
    return result.valid;
  };

  // ── Connection UX: ghost target computation ──────────────────────────
  function computeGhostTargets(sourceNodeId: string, sourceHandleId: string): GhostTarget[] {
    const sourceNode = diagram.nodes.find((n) => n.id === sourceNodeId);
    if (!sourceNode) return [];

    const sourceTypeId = sourceNode.type as ResourceTypeId;
    const validTargets = registry.edgeValidator.getValidTargets(sourceTypeId, sourceHandleId);

    const ghosts: GhostTarget[] = [];
    for (const rule of validTargets) {
      // Find all nodes of the target type on canvas
      for (const node of diagram.nodes) {
        if (node.id.startsWith('_')) continue; // skip synthetic nodes
        if (node.id === sourceNodeId) continue;
        if (node.type !== rule.targetType) continue;

        // Check the target handle exists on this node's schema
        const targetSchema = registry.getResourceSchema(rule.targetType);
        if (!targetSchema) continue;

        const targetHandle = targetSchema.handles?.find((h) => h.id === rule.targetHandle);
        if (!targetHandle) continue;

        ghosts.push({
          nodeId: node.id,
          handleId: rule.targetHandle,
          handleType: 'target',
          position: targetHandle.position,
        });
      }
    }

    return ghosts;
  }

  function handleConnectStart(event: MouseEvent | TouchEvent, params: { nodeId: string | null; handleId: string | null; handleType: string | null }) {
    if (!params.nodeId || !params.handleId) return;
    const ghosts = computeGhostTargets(params.nodeId, params.handleId);
    connectionUx.onDragStart(params.nodeId, params.handleId, ghosts);
  }

  function handleConnectEnd() {
    connectionUx.endDrag();
  }

  const onDelete: OnDelete = ({ nodes: deletedNodes, edges: deletedEdges }) => {
    for (const node of deletedNodes) {
      diagram.removeNode(node.id);
    }
    // With one-way edges={...} binding, edge deletions via keyboard must be
    // handled explicitly here (previously implicit via bind:edges).
    for (const edge of (deletedEdges ?? [])) {
      if (!edge.id.startsWith('ref-')) {
        diagram.removeEdge(edge.id);
      }
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
    if (targetNode.type === '_annotation_') return; // annotations can go anywhere — no feedback needed
    const absPos = getAbsolutePosition(targetNode.id);
    updateDragFeedback(absPos.x, absPos.y, targetNode.type as ResourceTypeId, targetNode.id);
  }

  /**
   * Handle node drag stop: reparent nodes based on their final position.
   * Allows dragging nodes into, out of, and between containers.
   */
  function handleNodeDragStop({ targetNode, nodes: draggedNodes }: { targetNode: DiagramNode | null; nodes: DiagramNode[]; event: MouseEvent | TouchEvent }) {
    clearDragFeedback();
    if (!targetNode) return;

    const draggedNode = targetNode;
    const isAnnotation = draggedNode.type === '_annotation_';
    const schema = isAnnotation ? null : registry.getResourceSchema(draggedNode.type as ResourceTypeId);
    if (!schema && !isAnnotation) return;

    // Compute the dragged node's absolute position
    const absPos = getAbsolutePosition(draggedNode.id);

    // If dropped on an invalid container, snap back to starting position
    if (!isAnnotation && isDropBlocked(absPos.x, absPos.y, schema!.typeId, draggedNode.id)) {
      diagram.nodes = diagram.nodes.map((n) => {
        const startPos = dragStartPositions.get(n.id);
        return startPos ? { ...n, position: startPos } : n;
      });
      dragStartPositions.clear();
      return;
    }
    dragStartPositions.clear();

    // Find the deepest valid container at this position (excluding self)
    const newParentId = isAnnotation
      ? findAnyContainerAtPosition(absPos.x, absPos.y, draggedNode.id)
      : findContainerAtPosition(absPos.x, absPos.y, schema!.typeId, draggedNode.id);
    const currentParentId = draggedNode.parentId as string | undefined;

    // If parent hasn't changed, nothing to do
    if (newParentId === currentParentId) return;

    // Auto-assign subnet CIDR when reparented into a new VNet
    let updatedProperties: Record<string, unknown> | undefined;
    if (newParentId && schema?.typeId === 'azurerm/networking/subnet') {
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

    // Notify connection wizard about containment change
    if (newParentId) {
      const containmentEntry = buildContainmentWizardEntry({
        childNode: draggedNode,
        parentNodeId: newParentId,
        registry,
        diagram,
      });
      if (containmentEntry) connectionWizard.notifyContainment(containmentEntry);
    }
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
    edges={displayEdges}
    {nodeTypes}
    {edgeTypes}
    {defaultEdgeOptions}
    colorMode={ui.theme}
    fitView
    minZoom={0.1}
    maxZoom={2}
    snapGrid={ui.snapToGrid ? [ui.gridSize, ui.gridSize] : undefined}
    selectionOnDrag
    panOnDrag={[1]}
    nodesDraggable={!spaceHeld}
    panActivationKey=" "
    selectionMode={SelectionMode.Full}
    {isValidConnection}
    onconnect={onConnect}
    onconnectstart={handleConnectStart}
    onconnectend={handleConnectEnd}
    ondelete={onDelete}
    onnodedragstart={(event) => { contextMenu = null; handleNodeDragStart(event); }}
    onnodedrag={handleNodeDrag}
    onnodedragstop={(event) => { handleNodeDragStop(event); diagram.saveSnapshot(); }}
    onnodeclick={({ node }) => { contextMenu = null; diagram.selectedEdgeId = null; diagram.selectedModuleId = null; diagram.selectedNodeId = node.id; }}
    onedgeclick={({ edge }) => { contextMenu = null; diagram.selectedNodeId = null; diagram.selectedModuleId = null; diagram.selectedEdgeId = edge.id; }}
    onpaneclick={() => { contextMenu = null; diagram.selectedNodeId = null; diagram.selectedEdgeId = null; diagram.selectedModuleId = null; connectionUx.reset(); }}
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
    <EdgeMarkers />
    {#if diagram.modules.length > 0 || diagram.moduleInstances.some((i) => i.collapsed === false)}
      <ViewportPortal target="front">
        {#each diagram.modules.filter((m) => !m.collapsed && !m.isTemplate) as mod (mod.id)}
          <ModuleBoundary
            module={mod}
            {screenToFlowPosition}
            onselect={(id) => { diagram.selectedNodeId = null; diagram.selectedEdgeId = null; diagram.selectedModuleId = id; }}
            ontogglecollapse={(id) => diagram.toggleModuleCollapsed(id)}
            oncreateinstance={(id) => handleCreateInstance(id)}
          />
        {/each}
        {#each diagram.moduleInstances.filter((i) => i.collapsed === false) as inst (inst.id)}
          <ModuleInstanceBoundary
            instance={inst}
            {screenToFlowPosition}
            onselect={(id) => { diagram.selectedNodeId = `_modinst_${id}`; diagram.selectedEdgeId = null; diagram.selectedModuleId = null; }}
            oncollapse={(id) => diagram.toggleInstanceCollapsed(id)}
          />
        {/each}
      </ViewportPortal>
    {/if}
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
        <span class="ctx-label"><svg class="ctx-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5" /><path d="M5.5 10.5H4a1.5 1.5 0 0 1-1.5-1.5V4A1.5 1.5 0 0 1 4 2.5h5A1.5 1.5 0 0 1 10.5 4v1.5" /></svg>Copy</span><span class="ctx-shortcut">Ctrl+C</span>
      </button>
      <button class="context-menu-item" onclick={handleContextDuplicate}>
        <span class="ctx-label"><svg class="ctx-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5" /><path d="M5.5 10.5H4a1.5 1.5 0 0 1-1.5-1.5V4A1.5 1.5 0 0 1 4 2.5h5A1.5 1.5 0 0 1 10.5 4v1.5" /><line x1="9.5" y1="8" x2="9.5" y2="12" /><line x1="7.5" y1="10" x2="11.5" y2="10" /></svg>Duplicate</span><span class="ctx-shortcut">Ctrl+D</span>
      </button>
      <div class="context-menu-separator"></div>
      <button class="context-menu-item" onclick={handleManageConnectionPoints}>
        <span class="ctx-label"><svg class="ctx-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="3" cy="8" r="1.5" /><circle cx="13" cy="4" r="1.5" /><circle cx="13" cy="12" r="1.5" /><path d="M4.5 8h3l2-4H11.5" /><path d="M4.5 8h3l2 4H11.5" /></svg>Manage Connection Points</span>
      </button>
      {#if contextNodeIsContainerWithChildren}
        <button class="context-menu-item" onclick={handleContextFitToContents}>
          <span class="ctx-label"><svg class="ctx-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 5.5V3a1 1 0 0 1 1-1h2.5" /><path d="M10.5 2H13a1 1 0 0 1 1 1v2.5" /><path d="M14 10.5V13a1 1 0 0 1-1 1h-2.5" /><path d="M5.5 14H3a1 1 0 0 1-1-1v-2.5" /><rect x="5" y="5" width="6" height="6" rx="1" /></svg>Fit to Contents</span>
        </button>
      {/if}
      {#if canCreateModule}
        <div class="context-menu-separator"></div>
        <button class="context-menu-item" onclick={handleCreateModule}>
          <span class="ctx-label"><svg class="ctx-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke-dasharray="3 2" /><path d="M5.5 8h5" /><path d="M8 5.5v5" /></svg>Create Module...</span>
        </button>
      {/if}
      {#if contextNodeModuleId}
        <button class="context-menu-item" onclick={handleRemoveFromModule}>
          <span class="ctx-label"><svg class="ctx-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke-dasharray="3 2" /><path d="M5.5 8h5" /></svg>Remove from Module</span>
        </button>
        {#if canConvertToTemplate}
          <button class="context-menu-item" onclick={handleConvertToTemplate}>
            <span class="ctx-label"><svg class="ctx-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="12" height="12" rx="2" /><path d="M5 6h6M5 8h6M5 10h4" opacity="0.6" /></svg>Convert to Template</span>
          </button>
        {/if}
        {#if contextNodeIsInTemplate}
          <button class="context-menu-item" onclick={() => handleCreateInstance()}>
            <span class="ctx-label"><svg class="ctx-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="12" height="12" rx="2" stroke-dasharray="3 2" /><path d="M8 5v6" /><path d="M5 8h6" /></svg>Create Instance...</span>
          </button>
        {/if}
      {/if}
      <div class="context-menu-separator"></div>
      <button class="context-menu-item" onclick={handleContextSelectAll}>
        <span class="ctx-label"><svg class="ctx-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="1" width="6" height="6" rx="1" /><rect x="9" y="1" width="6" height="6" rx="1" /><rect x="1" y="9" width="6" height="6" rx="1" /><rect x="9" y="9" width="6" height="6" rx="1" /></svg>Select All</span><span class="ctx-shortcut">Ctrl+A</span>
      </button>
      <div class="context-menu-separator"></div>
      <button class="context-menu-item context-menu-danger" onclick={handleContextDelete}>
        <span class="ctx-label"><svg class="ctx-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h12" /><path d="M5.5 4V2.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V4" /><path d="M12.5 4v9a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 13V4" /><line x1="6.5" y1="7" x2="6.5" y2="11.5" /><line x1="9.5" y1="7" x2="9.5" y2="11.5" /></svg>Delete</span><span class="ctx-shortcut">Del</span>
      </button>
    {:else if contextMenu.edgeId}
      <button class="context-menu-item context-menu-danger" onclick={handleContextDelete}>
        <span class="ctx-label"><svg class="ctx-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h12" /><path d="M5.5 4V2.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V4" /><path d="M12.5 4v9a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 13V4" /><line x1="6.5" y1="7" x2="6.5" y2="11.5" /><line x1="9.5" y1="7" x2="9.5" y2="11.5" /></svg>Delete Edge</span><span class="ctx-shortcut">Del</span>
      </button>
    {:else}
      <button class="context-menu-item" onclick={handleContextPaste} disabled={!diagram.hasClipboard}>
        <span class="ctx-label"><svg class="ctx-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 2.5h1A1.5 1.5 0 0 1 13 4v9.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 13.5V4a1.5 1.5 0 0 1 1.5-1.5h1" /><rect x="5.5" y="1" width="5" height="3" rx="1" /></svg>Paste</span><span class="ctx-shortcut">Ctrl+V</span>
      </button>
      <button class="context-menu-item" onclick={() => { const pos = screenToFlowPosition({ x: contextMenu!.x, y: contextMenu!.y }); diagram.addAnnotation(pos); closeContextMenu(); }}>
        <span class="ctx-label"><svg class="ctx-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="12" height="12" rx="1.5" /><line x1="5" y1="6" x2="11" y2="6" /><line x1="5" y1="8.5" x2="11" y2="8.5" /><line x1="5" y1="11" x2="9" y2="11" /></svg>Add Annotation</span><span class="ctx-shortcut">Ctrl+Shift+A</span>
      </button>
      <div class="context-menu-separator"></div>
      <button class="context-menu-item" onclick={handleContextSelectAll}>
        <span class="ctx-label"><svg class="ctx-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="1" width="6" height="6" rx="1" /><rect x="9" y="1" width="6" height="6" rx="1" /><rect x="1" y="9" width="6" height="6" rx="1" /><rect x="9" y="9" width="6" height="6" rx="1" /></svg>Select All</span><span class="ctx-shortcut">Ctrl+A</span>
      </button>
      <button class="context-menu-item" onclick={handleContextFitView}>
        <span class="ctx-label"><svg class="ctx-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 5.5V3a1 1 0 0 1 1-1h2.5" /><path d="M10.5 2H13a1 1 0 0 1 1 1v2.5" /><path d="M14 10.5V13a1 1 0 0 1-1 1h-2.5" /><path d="M5.5 14H3a1 1 0 0 1-1-1v-2.5" /></svg>Fit View</span>
      </button>
    {/if}
  </div>
{/if}

<!-- Handle Manager Modal -->
<ConnectionPointsModal
  isOpen={handleManagerModal !== null}
  nodeLabel={handleManagerModal?.nodeLabel ?? ''}
  initialConnectionPoints={handleManagerModal?.initialConnectionPoints ?? { top: 0, bottom: 0, left: 0, right: 0 }}
  initialHandlePositions={handleManagerModal?.initialHandlePositions ?? {}}
  schemaHandles={handleManagerModal?.schemaHandles ?? []}
  enabledOutputs={handleManagerModal?.enabledOutputs ?? []}
  onSave={handleSaveHandleManager}
  onClose={handleCloseHandleManager}
/>

<!-- Module Name Dialog -->
{#if showModuleNameDialog}
  <div class="module-dialog-backdrop" role="presentation">
    <!-- svelte-ignore a11y_autofocus -->
    <div class="module-dialog">
      <h3 class="module-dialog-title">Create Module</h3>
      <p class="module-dialog-desc">Enter a name for the module (lowercase, alphanumeric, hyphens).</p>
      <input
        class="module-dialog-input"
        type="text"
        placeholder="e.g. networking"
        bind:value={moduleNameInput}
        autofocus
        onkeydown={(e) => { if (e.key === 'Enter') confirmCreateModule(); if (e.key === 'Escape') showModuleNameDialog = false; }}
      />
      <div class="module-dialog-actions">
        <button class="module-dialog-btn module-dialog-cancel" onclick={() => showModuleNameDialog = false}>Cancel</button>
        <button
          class="module-dialog-btn module-dialog-confirm"
          disabled={!moduleNameInput.trim()}
          onclick={confirmCreateModule}
        >Create</button>
      </div>
    </div>
  </div>
{/if}

<!-- Instance Name Dialog -->
{#if showInstanceNameDialog}
  <div class="module-dialog-backdrop" role="presentation">
    <!-- svelte-ignore a11y_autofocus -->
    <div class="module-dialog">
      <h3 class="module-dialog-title">Create Instance</h3>
      <p class="module-dialog-desc">Enter a name for the module instance (lowercase, alphanumeric, underscores).</p>
      <input
        class="module-dialog-input"
        type="text"
        placeholder="e.g. net_prod"
        bind:value={instanceNameInput}
        autofocus
        oninput={() => instanceNameError = ''}
        onkeydown={(e) => { if (e.key === 'Enter') confirmCreateInstance(); if (e.key === 'Escape') showInstanceNameDialog = false; }}
      />
      {#if instanceNameError}
        <p class="module-dialog-error">{instanceNameError}</p>
      {/if}
      <div class="module-dialog-actions">
        <button class="module-dialog-btn module-dialog-cancel" onclick={() => showInstanceNameDialog = false}>Cancel</button>
        <button
          class="module-dialog-btn module-dialog-confirm"
          disabled={!instanceNameInput.trim()}
          onclick={confirmCreateInstance}
        >Create</button>
      </div>
    </div>
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
    font-size: var(--font-12);
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
  .ctx-label {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .ctx-icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    color: var(--color-text-muted);
  }
  .context-menu-danger .ctx-icon {
    color: inherit;
  }
  .ctx-shortcut {
    font-size: var(--font-11);
    color: var(--color-text-muted);
    margin-left: 24px;
  }
  .context-menu-separator {
    height: 1px;
    background: var(--color-border);
    margin: 4px 0;
  }

  /* Module name dialog */
  .module-dialog-backdrop {
    position: fixed;
    inset: 0;
    z-index: 2000;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .module-dialog {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 20px;
    min-width: 320px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }
  .module-dialog-title {
    margin: 0 0 4px;
    font-size: var(--font-14);
    font-weight: 600;
    color: var(--color-text);
  }
  .module-dialog-desc {
    margin: 0 0 12px;
    font-size: var(--font-12);
    color: var(--color-text-muted);
  }
  .module-dialog-error {
    margin: 4px 0 0;
    font-size: var(--font-11);
    color: #f87171;
  }
  .module-dialog-input {
    width: 100%;
    padding: 6px 10px;
    font-size: var(--font-13);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-surface);
    color: var(--color-text);
    outline: none;
    box-sizing: border-box;
  }
  .module-dialog-input:focus {
    border-color: var(--color-primary, #6366f1);
  }
  .module-dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 14px;
  }
  .module-dialog-btn {
    padding: 5px 14px;
    font-size: var(--font-12);
    border-radius: 4px;
    border: 1px solid var(--color-border);
    cursor: pointer;
  }
  .module-dialog-cancel {
    background: none;
    color: var(--color-text-muted);
  }
  .module-dialog-confirm {
    background: var(--color-primary, #6366f1);
    color: white;
    border-color: var(--color-primary, #6366f1);
  }
  .module-dialog-confirm:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
