<script lang="ts">
  import { connectionWizard, ConnectionWizardStore } from '$lib/stores/connection-wizard.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import type { ConnectionWizardEntry } from '$lib/stores/connection-wizard.svelte';

  let { entry, compact = false }: { entry: ConnectionWizardEntry; compact?: boolean } = $props();

  const typeKey = $derived(ConnectionWizardStore.typeKey(entry.sourceTypeId, entry.targetTypeId));
  const isDismissed = $derived(connectionWizard.isDismissed(typeKey));

  function toggleDismiss() {
    if (isDismissed) {
      connectionWizard.undismiss(typeKey);
    } else {
      connectionWizard.dismiss(typeKey);
    }
  }

  function selectNode(nodeId: string) {
    ui.navigateToNode(nodeId);
  }

  const kindLabel = $derived(
    entry.kind === 'binding' ? 'BINDING' :
    entry.kind === 'containment' ? 'CONTAINMENT' : 'REFERENCE'
  );

  const kindColor = $derived(
    entry.kind === 'binding' ? 'var(--color-warning, #f59e0b)' :
    entry.kind === 'containment' ? 'var(--color-info, #3b82f6)' : 'var(--color-accent)'
  );
</script>

<div class="wizard-card" class:compact>
  <!-- Header -->
  <div class="card-header">
    <div class="connection-flow">
      <button class="node-label source" onclick={() => selectNode(entry.sourceNodeId)} title="Focus {entry.sourceLabel}">
        {entry.sourceDisplayName}
        <span class="node-name">{entry.sourceLabel}</span>
      </button>
      <span class="arrow">→</span>
      <button class="node-label target" onclick={() => selectNode(entry.targetNodeId)} title="Focus {entry.targetLabel}">
        {entry.targetDisplayName}
        <span class="node-name">{entry.targetLabel}</span>
      </button>
    </div>
    <span class="kind-badge" style="--badge-color: {kindColor}">{kindLabel}</span>
  </div>

  <!-- Description -->
  <div class="description">{entry.description}</div>

  <!-- Terraform snippet -->
  {#if entry.terraformSnippet}
    <pre class="snippet">{entry.terraformSnippet}</pre>
  {/if}

  <!-- Auto-filled properties -->
  {#if entry.autoFilledProperties.length > 0}
    <div class="auto-filled">
      <span class="section-label">Auto-filled:</span>
      {#each entry.autoFilledProperties as prop}
        <div class="prop-row">
          <code class="prop-key">{prop.propertyKey}</code>
          <span class="prop-arrow">←</span>
          <code class="prop-value">{prop.value}</code>
          <span class="prop-side">on {prop.side}</span>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Binding resource -->
  {#if entry.kind === 'binding' && entry.bindingResourceType}
    <div class="binding-info">
      <span class="generates-label">Generates:</span>
      <code class="binding-type">{entry.bindingResourceType}</code>
    </div>
  {/if}

  <!-- Containment details -->
  {#if entry.kind === 'containment' && entry.parentPropertyKey}
    <div class="containment-info">
      <code>{entry.parentPropertyKey}</code> derived from parent {entry.parentContainerLabel || 'container'}
    </div>
  {/if}

  <!-- Footer -->
  {#if !compact}
    <div class="card-footer">
      <label class="dismiss-toggle">
        <input type="checkbox" checked={isDismissed} onchange={toggleDismiss} />
        <span>Don't show again for this type</span>
      </label>
    </div>
  {/if}
</div>

<style>
  .wizard-card {
    background: var(--color-surface, #1e1e2e);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 10px 12px;
    font-size: 12px;
  }

  .wizard-card.compact {
    padding: 8px 10px;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }

  .connection-flow {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }

  .node-label {
    display: flex;
    flex-direction: column;
    gap: 1px;
    background: none;
    border: none;
    padding: 2px 6px;
    border-radius: 3px;
    cursor: pointer;
    color: var(--color-text);
    font-size: 11px;
    font-weight: 600;
    text-align: left;
    min-width: 0;
  }

  .node-label:hover {
    background: var(--color-surface-hover);
  }

  .node-name {
    font-weight: 400;
    font-size: 10px;
    color: var(--color-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .arrow {
    color: var(--color-text-muted);
    font-size: 14px;
    flex-shrink: 0;
  }

  .kind-badge {
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 2px 6px;
    border-radius: 3px;
    background: color-mix(in srgb, var(--badge-color) 15%, transparent);
    color: var(--badge-color);
    flex-shrink: 0;
  }

  .description {
    color: var(--color-text-muted);
    font-size: 11px;
    line-height: 1.5;
    margin-bottom: 8px;
  }

  .snippet {
    background: var(--color-bg, #111);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    padding: 8px 10px;
    font-family: 'Cascadia Code', 'Fira Code', monospace;
    font-size: 11px;
    line-height: 1.5;
    color: var(--color-text);
    overflow-x: auto;
    margin-bottom: 8px;
    white-space: pre;
  }

  .auto-filled {
    margin-bottom: 8px;
  }

  .section-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
    display: block;
    margin-bottom: 4px;
  }

  .prop-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 0;
  }

  .prop-key {
    font-size: 11px;
    color: var(--color-accent);
  }

  .prop-arrow {
    color: var(--color-text-muted);
    font-size: 10px;
  }

  .prop-value {
    font-size: 11px;
    color: var(--color-text);
  }

  .prop-side {
    font-size: 10px;
    color: var(--color-text-muted);
    font-style: italic;
  }

  .binding-info {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    background: color-mix(in srgb, var(--color-warning, #f59e0b) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-warning, #f59e0b) 25%, transparent);
    border-radius: 4px;
    margin-bottom: 8px;
  }

  .generates-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--color-warning, #f59e0b);
  }

  .binding-type {
    font-size: 11px;
    color: var(--color-text);
  }

  .containment-info {
    font-size: 11px;
    color: var(--color-text-muted);
    padding: 4px 8px;
    background: color-mix(in srgb, var(--color-info, #3b82f6) 10%, transparent);
    border-radius: 4px;
    margin-bottom: 8px;
  }

  .containment-info code {
    color: var(--color-accent);
  }

  .card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 6px;
    border-top: 1px solid var(--color-border);
  }

  .dismiss-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: var(--color-text-muted);
    cursor: pointer;
  }

  .dismiss-toggle input {
    width: 12px;
    height: 12px;
    accent-color: var(--color-accent);
    cursor: pointer;
  }
</style>
