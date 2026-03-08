<script lang="ts">
  import { Handle, Position, useConnection } from '@xyflow/svelte';
  import { registry } from '$lib/bootstrap';
  import type { HandleDefinition, ResourceTypeId } from '@terrastudio/types';

  let { handle, nodeTypeId, style, compact = false, hovered = false, connected = false, ghost = false, visible = false }: { handle: HandleDefinition; nodeTypeId: ResourceTypeId; style?: string; compact?: boolean; hovered?: boolean; connected?: boolean; ghost?: boolean; visible?: boolean } = $props();

  const positionMap = {
    top: Position.Top,
    bottom: Position.Bottom,
    left: Position.Left,
    right: Position.Right,
  } as const;

  const connection = useConnection();

  let highlightState = $derived.by(() => {
    const conn = connection.current;
    if (!conn.inProgress || !conn.fromNode || !conn.fromHandle) return 'neutral';

    const fromTypeId = conn.fromNode.type as ResourceTypeId;
    const fromHandleId = conn.fromHandle.id ?? '';
    const fromHandleType = conn.fromHandle.type;

    // If dragging from a source handle, highlight valid targets
    if (fromHandleType === 'source' && handle.type === 'target') {
      const result = registry.edgeValidator.validate(fromTypeId, fromHandleId, nodeTypeId, handle.id);
      return result.valid ? 'compatible' : 'incompatible';
    }

    // If dragging from a target handle, highlight valid sources
    if (fromHandleType === 'target' && handle.type === 'source') {
      const result = registry.edgeValidator.validate(nodeTypeId, handle.id, fromTypeId, fromHandleId);
      return result.valid ? 'compatible' : 'incompatible';
    }

    return 'neutral';
  });

  // Hide handles by default — the directional arrow menu replaces direct handle interaction.
  // Show when: explicitly visible, connected to an edge, during a connection drag, or ghost-highlighted.
  let isDragging = $derived(connection.current.inProgress);
  let hideHandle = $derived(!visible && !connected && !isDragging && !ghost);
  // Handle labels: shown when visible, hovered, or ghost
  let hideLabel = $derived(!visible && !hovered && !ghost);
</script>

<Handle
  type={handle.type}
  position={positionMap[handle.position]}
  id={handle.id}
  class="{highlightState === 'compatible' ? 'handle-compatible' : highlightState === 'incompatible' ? 'handle-incompatible' : ''}{hideHandle ? ' handle-hidden' : ''}{ghost ? ' handle-ghost' : ''}"
  style={style}
>
  {#snippet children()}
    {#if !hideLabel}
      <span
        class="handle-label"
        class:handle-label-top={handle.position === 'top'}
        class:handle-label-bottom={handle.position === 'bottom'}
        class:handle-label-left={handle.position === 'left'}
        class:handle-label-right={handle.position === 'right'}
      >
        {handle.label}
      </span>
    {/if}
  {/snippet}
</Handle>

<style>
  .handle-label {
    position: absolute;
    font-size: var(--font-9);
    color: #8b90a0;
    pointer-events: none;
    white-space: nowrap;
    user-select: none;
    line-height: 1;
  }
  .handle-label-top {
    bottom: calc(100% + 4px);
    left: 50%;
    transform: translateX(-50%);
  }
  .handle-label-bottom {
    top: calc(100% + 4px);
    left: 50%;
    transform: translateX(-50%);
  }
  .handle-label-left {
    right: calc(100% + 6px);
    top: 50%;
    transform: translateY(-50%);
  }
  .handle-label-right {
    left: calc(100% + 6px);
    top: 50%;
    transform: translateY(-50%);
  }
  :global(.handle-hidden) {
    opacity: 0 !important;
    pointer-events: none !important;
  }
  :global(.handle-ghost) {
    background: #3b82f6 !important;
    border-color: #60a5fa !important;
    opacity: 0.7 !important;
    animation: ghost-pulse 1.5s ease-in-out infinite;
    box-shadow: 0 0 6px rgba(59, 130, 246, 0.4);
  }
  @keyframes ghost-pulse {
    0%, 100% { opacity: 0.7; box-shadow: 0 0 6px rgba(59, 130, 246, 0.4); }
    50% { opacity: 1; box-shadow: 0 0 10px rgba(59, 130, 246, 0.6); }
  }
</style>
