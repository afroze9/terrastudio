<script lang="ts">
  import { Handle, Position, useConnection } from '@xyflow/svelte';
  import { registry } from '$lib/bootstrap';
  import type { HandleDefinition, ResourceTypeId } from '@terrastudio/types';

  let { handle, nodeTypeId, style }: { handle: HandleDefinition; nodeTypeId: ResourceTypeId; style?: string } = $props();

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
</script>

<Handle
  type={handle.type}
  position={positionMap[handle.position]}
  id={handle.id}
  class={highlightState === 'compatible' ? 'handle-compatible' : highlightState === 'incompatible' ? 'handle-incompatible' : ''}
  style={style}
>
  {#snippet children()}
    <span
      class="handle-label"
      class:handle-label-top={handle.position === 'top'}
      class:handle-label-bottom={handle.position === 'bottom'}
      class:handle-label-left={handle.position === 'left'}
      class:handle-label-right={handle.position === 'right'}
    >
      {handle.label}
    </span>
  {/snippet}
</Handle>

<style>
  .handle-label {
    position: absolute;
    font-size: 9px;
    color: var(--color-text-muted, #8b90a0);
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
</style>
