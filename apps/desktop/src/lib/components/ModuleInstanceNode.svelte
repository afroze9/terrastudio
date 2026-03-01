<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';
  import { diagram } from '$lib/stores/diagram.svelte';

  let { data, id, selected }: { data: any; id: string; selected?: boolean } = $props();

  const instanceId = $derived(data.instanceId as string);
  const instance = $derived(diagram.moduleInstances.find((i) => i.id === instanceId));
  const template = $derived(
    instance ? diagram.modules.find((m) => m.id === instance.templateId) : undefined,
  );
  const borderColor = $derived(instance?.color ?? template?.color ?? '#6366f1');

  /** Count of variable overrides set on this instance */
  const varCount = $derived(
    instance ? Object.keys(instance.variableValues).filter((k) => instance.variableValues[k] !== undefined && instance.variableValues[k] !== '').length : 0,
  );

  /**
   * Derived handles from the template's cross-module edges.
   * Instance handles mirror the template's boundary connections.
   */
  const derivedHandles = $derived.by(() => {
    const handles: Array<{ id: string; type: 'source' | 'target'; position: 'left' | 'right'; label: string }> = [];
    if (!instance || !template) return handles;

    const templateMemberIds = new Set(
      diagram.nodes.filter((n) => n.data.moduleId === template.id).map((n) => n.id),
    );

    const seenHandleIds = new Set<string>();
    const allEdges = [...diagram.edges, ...diagram.referenceEdges];

    for (const edge of allEdges) {
      const srcIn = templateMemberIds.has(edge.source);
      const tgtIn = templateMemberIds.has(edge.target);

      if (srcIn && !tgtIn) {
        // Outgoing from template member
        const handleId = `inst-out-${instanceId}-${edge.source}-${edge.sourceHandle ?? 'default'}`;
        if (!seenHandleIds.has(handleId)) {
          seenHandleIds.add(handleId);
          handles.push({
            id: handleId,
            type: 'source',
            position: 'right',
            label: (edge.data as any)?.label ?? '',
          });
        }
      } else if (!srcIn && tgtIn) {
        // Incoming to template member
        const handleId = `inst-in-${instanceId}-${edge.target}-${edge.targetHandle ?? 'default'}`;
        if (!seenHandleIds.has(handleId)) {
          seenHandleIds.add(handleId);
          handles.push({
            id: handleId,
            type: 'target',
            position: 'left',
            label: (edge.data as any)?.label ?? '',
          });
        }
      }
    }

    return handles;
  });

  const sourceHandles = $derived(derivedHandles.filter((h) => h.type === 'source'));
  const targetHandles = $derived(derivedHandles.filter((h) => h.type === 'target'));
  const maxHandles = $derived(Math.max(sourceHandles.length, targetHandles.length));
  const nodeMinHeight = $derived(Math.max(60, 40 + maxHandles * 20));

  function handleClick() {
    if (instanceId) {
      diagram.selectedNodeId = id;
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="instance-node"
  class:selected
  style:--instance-color={borderColor}
  style:min-height="{nodeMinHeight}px"
  onclick={handleClick}
>
  <div class="instance-header">
    <svg class="instance-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="2" width="12" height="12" rx="2" />
      <path d="M5 6h6M5 8h6M5 10h4" opacity="0.6" />
    </svg>
    <span class="instance-name">{instance?.name ?? 'Instance'}</span>
    {#if varCount > 0}
      <span class="instance-badge">{varCount} var{varCount !== 1 ? 's' : ''}</span>
    {/if}
  </div>
  <div class="instance-template-ref">{template?.name ?? 'template'}</div>

  {#each targetHandles as handle, i (handle.id)}
    {@const pct = (i + 1) / (targetHandles.length + 1) * 100}
    <Handle
      type="target"
      position={Position.Left}
      id={handle.id}
      style="top: {pct}%;"
    />
  {/each}

  {#each sourceHandles as handle, i (handle.id)}
    {@const pct = (i + 1) / (sourceHandles.length + 1) * 100}
    <Handle
      type="source"
      position={Position.Right}
      id={handle.id}
      style="top: {pct}%;"
    />
  {/each}
</div>

<style>
  .instance-node {
    min-width: 160px;
    background: var(--color-surface, #1e1e2e);
    border: 2px dashed var(--instance-color);
    border-radius: 8px;
    padding: 10px 14px;
    font-family: inherit;
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .instance-node.selected {
    box-shadow: 0 0 0 2px var(--instance-color);
  }

  .instance-header {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .instance-icon {
    color: var(--instance-color);
    flex-shrink: 0;
  }

  .instance-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text, #cdd6f4);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .instance-badge {
    font-size: 10px;
    font-weight: 600;
    color: white;
    background: var(--instance-color);
    border-radius: 8px;
    padding: 1px 6px;
    min-width: 18px;
    text-align: center;
    margin-left: auto;
    white-space: nowrap;
  }

  .instance-template-ref {
    font-size: 10px;
    color: var(--color-text-muted, #6c7086);
    margin-top: 4px;
    font-style: italic;
  }
</style>
