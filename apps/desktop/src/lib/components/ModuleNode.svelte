<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';
  import { diagram } from '$lib/stores/diagram.svelte';

  let { data, id, selected }: { data: any; id: string; selected?: boolean } = $props();

  const moduleId = $derived(data.moduleId as string);
  const mod = $derived(diagram.modules.find((m) => m.id === moduleId));
  const memberCount = $derived(data.memberCount as number ?? 0);
  const borderColor = $derived(mod?.color ?? '#6366f1');

  /** Derived handles from cross-module edges */
  const derivedHandles = $derived.by(() => {
    const handles: Array<{ id: string; type: 'source' | 'target'; position: 'left' | 'right'; label: string }> = [];
    if (!moduleId) return handles;

    const memberIds = new Set(
      diagram.nodes.filter((n) => n.data.moduleId === moduleId).map((n) => n.id),
    );

    // Track seen connections to deduplicate
    const seenTargets = new Set<string>();
    const seenSources = new Set<string>();

    for (const edge of diagram.edges) {
      const srcIn = memberIds.has(edge.source);
      const tgtIn = memberIds.has(edge.target);

      if (srcIn && !tgtIn) {
        // Outgoing: source inside module → target outside
        const key = `${edge.target}-${edge.targetHandle ?? 'default'}`;
        if (!seenSources.has(key)) {
          seenSources.add(key);
          handles.push({
            id: `mod-out-${edge.sourceHandle ?? edge.source}`,
            type: 'source',
            position: 'right',
            label: (edge.data as any)?.label ?? '',
          });
        }
      } else if (!srcIn && tgtIn) {
        // Incoming: source outside → target inside module
        const key = `${edge.source}-${edge.sourceHandle ?? 'default'}`;
        if (!seenTargets.has(key)) {
          seenTargets.add(key);
          handles.push({
            id: `mod-in-${edge.targetHandle ?? edge.target}`,
            type: 'target',
            position: 'left',
            label: (edge.data as any)?.label ?? '',
          });
        }
      }
    }

    return handles;
  });

  function handleExpand() {
    if (moduleId) diagram.toggleModuleCollapsed(moduleId);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="module-node"
  class:selected
  style:--module-color={borderColor}
  ondblclick={handleExpand}
>
  <div class="module-node-header">
    <svg class="module-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke-dasharray="3 2" />
      <rect x="4" y="4" width="3.5" height="3.5" rx="0.5" fill="currentColor" stroke="none" opacity="0.4" />
      <rect x="8.5" y="4" width="3.5" height="3.5" rx="0.5" fill="currentColor" stroke="none" opacity="0.4" />
      <rect x="4" y="8.5" width="3.5" height="3.5" rx="0.5" fill="currentColor" stroke="none" opacity="0.4" />
    </svg>
    <span class="module-node-name">{mod?.name ?? 'Module'}</span>
    <span class="module-node-badge">{memberCount}</span>
  </div>
  <div class="module-node-hint">Double-click to expand</div>

  {#each derivedHandles.filter((h) => h.type === 'target') as handle, i (handle.id)}
    <Handle
      type="target"
      position={Position.Left}
      id={handle.id}
      style="top: {30 + i * 20}px;"
    />
  {/each}

  {#each derivedHandles.filter((h) => h.type === 'source') as handle, i (handle.id)}
    <Handle
      type="source"
      position={Position.Right}
      id={handle.id}
      style="top: {30 + i * 20}px;"
    />
  {/each}
</div>

<style>
  .module-node {
    min-width: 160px;
    background: var(--color-surface, #1e1e2e);
    border: 2px solid var(--module-color);
    border-radius: 8px;
    padding: 10px 14px;
    font-family: inherit;
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .module-node.selected {
    box-shadow: 0 0 0 2px var(--module-color);
  }

  .module-node-header {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .module-icon {
    color: var(--module-color);
    flex-shrink: 0;
  }

  .module-node-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text, #cdd6f4);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .module-node-badge {
    font-size: 10px;
    font-weight: 600;
    color: white;
    background: var(--module-color);
    border-radius: 8px;
    padding: 1px 6px;
    min-width: 18px;
    text-align: center;
    margin-left: auto;
  }

  .module-node-hint {
    font-size: 10px;
    color: var(--color-text-muted, #6c7086);
    margin-top: 4px;
  }
</style>
