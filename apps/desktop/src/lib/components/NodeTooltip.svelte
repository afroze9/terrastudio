<script lang="ts">
  import type { ResourceSchema } from '@terrastudio/types';
  import { onMount } from 'svelte';
  import type { Action } from 'svelte/action';

  let {
    schema,
    terraformName,
    deploymentStatus,
    properties,
    visible,
    anchorEl,
  }: {
    schema: ResourceSchema;
    terraformName: string;
    deploymentStatus?: string;
    properties: Record<string, unknown>;
    visible: boolean;
    anchorEl?: HTMLElement;
  } = $props();

  let keyProperties = $derived(
    schema.properties
      .filter((p) => p.group === 'General' || p.order !== undefined)
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
      .slice(0, 3)
      .map((p) => ({ label: p.label, value: properties[p.key] }))
      .filter((p) => p.value !== undefined && p.value !== ''),
  );

  let statusLabel = $derived(deploymentStatus ?? 'pending');

  // Portal container element
  let portalEl = $state<HTMLDivElement | null>(null);
  let posX = $state(0);
  let posY = $state(0);

  // Create portal container on mount
  onMount(() => {
    const el = document.createElement('div');
    el.className = 'node-tooltip-portal-container';
    document.body.appendChild(el);
    portalEl = el;

    return () => {
      if (el.parentNode) {
        document.body.removeChild(el);
      }
    };
  });

  // Update position whenever visible or anchorEl changes
  $effect(() => {
    if (visible && anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      posX = rect.left + rect.width / 2;
      posY = rect.top - 8;
    }
  });

  // Svelte action to portal an element to a target container
  const portal: Action<HTMLElement, HTMLElement> = (node, target) => {
    target.appendChild(node);
    return {
      destroy() {
        if (node.parentNode === target) {
          target.removeChild(node);
        }
      }
    };
  };
</script>

{#if visible && anchorEl && portalEl}
  <div
    class="node-tooltip-portal"
    style="left: {posX}px; top: {posY}px;"
    role="tooltip"
    use:portal={portalEl}
  >
    <div class="tooltip-header">
      <span class="tooltip-type">{schema.displayName}</span>
      <span class="tooltip-status" class:deployed={statusLabel === 'created'}>
        {statusLabel}
      </span>
    </div>
    <div class="tooltip-tf">{schema.terraformType}.{terraformName}</div>
    {#if keyProperties.length > 0}
      <div class="tooltip-props">
        {#each keyProperties as prop}
          <div class="tooltip-prop">
            <span class="prop-label">{prop.label}</span>
            <span class="prop-value">{typeof prop.value === 'object' ? JSON.stringify(prop.value) : String(prop.value)}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .node-tooltip-portal {
    position: fixed;
    transform: translate(-50%, -100%);
    background: var(--color-surface, #1a1d27);
    border: 1px solid var(--color-border, #2e3347);
    border-radius: 6px;
    padding: 8px 12px;
    min-width: 200px;
    max-width: 300px;
    z-index: 9999;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    pointer-events: none;
    font-size: 11px;
  }
  .tooltip-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;
  }
  .tooltip-type {
    font-weight: 600;
    color: var(--color-text, #e1e4ed);
  }
  .tooltip-status {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 3px;
    background: rgba(107, 114, 128, 0.2);
    color: #9ca3af;
  }
  .tooltip-status.deployed {
    background: rgba(34, 197, 94, 0.15);
    color: #22c55e;
  }
  .tooltip-tf {
    font-size: 10px;
    color: var(--color-text-muted, #8b90a0);
    font-family: monospace;
    margin-bottom: 4px;
  }
  .tooltip-props {
    border-top: 1px solid var(--color-border, #2e3347);
    padding-top: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .tooltip-prop {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .prop-label {
    color: var(--color-text-muted, #8b90a0);
  }
  .prop-value {
    color: var(--color-text, #e1e4ed);
    font-family: monospace;
    text-align: right;
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
