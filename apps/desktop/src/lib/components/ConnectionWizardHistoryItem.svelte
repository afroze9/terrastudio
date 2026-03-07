<script lang="ts">
  import type { ConnectionWizardEntry } from '$lib/stores/connection-wizard.svelte';
  import ConnectionWizardCard from './ConnectionWizardCard.svelte';

  let { entry }: { entry: ConnectionWizardEntry } = $props();
  let expanded = $state(false);

  const timeStr = $derived(new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

  const kindIcon = $derived(
    entry.kind === 'binding' ? '⇄' :
    entry.kind === 'containment' ? '▣' : '→'
  );
</script>

<div class="history-item">
  <button class="history-row" onclick={() => expanded = !expanded}>
    <span class="kind-icon">{kindIcon}</span>
    <span class="flow-label">
      {entry.sourceDisplayName}
      <span class="flow-arrow">→</span>
      {entry.targetDisplayName}
    </span>
    {#if entry.connectionLabel}
      <span class="connection-badge">{entry.connectionLabel}</span>
    {/if}
    <span class="timestamp">{timeStr}</span>
    <span class="chevron" class:open={expanded}>›</span>
  </button>
  {#if expanded}
    <div class="expanded-content">
      <ConnectionWizardCard {entry} compact />
    </div>
  {/if}
</div>

<style>
  .history-item {
    border-bottom: 1px solid var(--color-border);
  }

  .history-item:last-child {
    border-bottom: none;
  }

  .history-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 10px;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text);
    font-size: var(--font-11);
    text-align: left;
  }

  .history-row:hover {
    background: var(--color-surface-hover);
  }

  .kind-icon {
    font-size: var(--font-12);
    flex-shrink: 0;
    width: 16px;
    text-align: center;
    color: var(--color-text-muted);
  }

  .flow-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .flow-arrow {
    color: var(--color-text-muted);
    margin: 0 2px;
  }

  .connection-badge {
    font-size: var(--font-9);
    padding: 1px 5px;
    border-radius: 3px;
    background: var(--color-surface-hover);
    color: var(--color-text-muted);
    flex-shrink: 0;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .timestamp {
    font-size: var(--font-10);
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  .chevron {
    font-size: var(--font-14);
    color: var(--color-text-muted);
    flex-shrink: 0;
    transition: transform 0.15s;
    transform: rotate(0deg);
  }

  .chevron.open {
    transform: rotate(90deg);
  }

  .expanded-content {
    padding: 4px 10px 8px;
  }
</style>
