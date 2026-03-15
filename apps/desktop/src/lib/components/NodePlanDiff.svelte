<script lang="ts">
  import { plan } from '$lib/stores/plan.svelte';
  import { diagram } from '$lib/stores/diagram.svelte';

  let change = $derived(plan.diffNodeId ? plan.getNodeChange(plan.diffNodeId) : null);
  let node = $derived(plan.diffNodeId ? diagram.nodes.find((n) => n.id === plan.diffNodeId) : null);

  let actionLabel = $derived.by(() => {
    if (!change) return '';
    switch (change.action) {
      case 'create': return 'Create';
      case 'update': return 'Update';
      case 'delete': return 'Destroy';
      case 'replace': return 'Replace (destroy + create)';
      case 'no-op': return 'No changes';
      case 'read': return 'Read';
      default: return change.action;
    }
  });

  let actionColor = $derived.by(() => {
    if (!change) return '#6b7280';
    switch (change.action) {
      case 'create': return '#22c55e';
      case 'update': return '#f59e0b';
      case 'delete': return '#ef4444';
      case 'replace': return '#f97316';
      default: return '#6b7280';
    }
  });

  // Compute diff rows
  let diffRows = $derived.by(() => {
    if (!change) return [];
    const rows: Array<{ key: string; before: string; after: string; status: 'added' | 'removed' | 'changed' | 'unchanged' }> = [];
    const allKeys = new Set([
      ...Object.keys(change.before ?? {}),
      ...Object.keys(change.after ?? {}),
    ]);

    for (const key of [...allKeys].sort()) {
      const bVal = change.before?.[key];
      const aVal = change.after?.[key];
      const bStr = formatValue(bVal);
      const aStr = formatValue(aVal);

      if (bVal === undefined && aVal !== undefined) {
        rows.push({ key, before: '', after: aStr, status: 'added' });
      } else if (bVal !== undefined && aVal === undefined) {
        rows.push({ key, before: bStr, after: '', status: 'removed' });
      } else if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
        rows.push({ key, before: bStr, after: aStr, status: 'changed' });
      } else {
        rows.push({ key, before: bStr, after: aStr, status: 'unchanged' });
      }
    }
    return rows;
  });

  let changedRows = $derived(diffRows.filter((r) => r.status !== 'unchanged'));
  let unchangedRows = $derived(diffRows.filter((r) => r.status === 'unchanged'));
  let showUnchanged = $state(false);

  function formatValue(val: unknown): string {
    if (val === undefined || val === null) return '-';
    if (val === '(sensitive)') return '(sensitive)';
    if (typeof val === 'string') return val.length > 80 ? val.slice(0, 80) + '\u2026' : val;
    if (typeof val === 'boolean' || typeof val === 'number') return String(val);
    const json = JSON.stringify(val);
    return json.length > 80 ? json.slice(0, 80) + '\u2026' : json;
  }

  function close() {
    plan.diffNodeId = null;
  }
</script>

{#if change && plan.diffNodeId}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="diff-backdrop" onclick={close}></div>
  <div class="diff-popover" role="dialog" aria-label="Plan diff for {node?.data.displayLabel || node?.data.label || 'resource'}">
    <div class="diff-header" style="border-color: {actionColor};">
      <span class="diff-action" style="color: {actionColor};">{actionLabel}</span>
      <span class="diff-address">{change.address}</span>
      <button class="diff-close" onclick={close} aria-label="Close">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
    <div class="diff-body">
      {#if changedRows.length === 0 && change.action === 'no-op'}
        <div class="diff-empty">No property changes</div>
      {:else}
        <table class="diff-table">
          <thead>
            <tr>
              <th>Property</th>
              <th>Before</th>
              <th>After</th>
            </tr>
          </thead>
          <tbody>
            {#each changedRows as row}
              <tr class="diff-row {row.status}">
                <td class="diff-key">{row.key}</td>
                <td class="diff-val before">{row.before}</td>
                <td class="diff-val after">{row.after}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        {#if unchangedRows.length > 0}
          <button class="unchanged-toggle" onclick={() => showUnchanged = !showUnchanged}>
            {showUnchanged ? 'Hide' : 'Show'} {unchangedRows.length} unchanged
          </button>
          {#if showUnchanged}
            <table class="diff-table unchanged-table">
              <tbody>
                {#each unchangedRows as row}
                  <tr class="diff-row unchanged">
                    <td class="diff-key">{row.key}</td>
                    <td class="diff-val">{row.before}</td>
                    <td class="diff-val">{row.after}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
        {/if}
      {/if}
    </div>
  </div>
{/if}

<style>
  .diff-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 25;
  }

  .diff-popover {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(600px, 90vw);
    max-height: 70vh;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    z-index: 30;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .diff-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 2px solid;
    flex-shrink: 0;
  }

  .diff-action {
    font-weight: 600;
    font-size: var(--font-13);
  }

  .diff-address {
    flex: 1;
    color: var(--color-text-muted);
    font-size: var(--font-11);
    font-family: monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .diff-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    border-radius: 3px;
    padding: 0;
  }
  .diff-close:hover {
    background: var(--color-bg-hover, rgba(255, 255, 255, 0.08));
    color: var(--color-text);
  }

  .diff-body {
    overflow-y: auto;
    padding: 8px;
  }

  .diff-empty {
    text-align: center;
    color: var(--color-text-muted);
    padding: 16px;
    font-size: var(--font-12);
  }

  .diff-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--font-11);
  }

  .diff-table th {
    text-align: left;
    padding: 4px 8px;
    color: var(--color-text-muted);
    font-size: var(--font-10);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid var(--color-border);
  }

  .diff-row td {
    padding: 3px 8px;
    border-bottom: 1px solid rgba(128, 128, 128, 0.1);
    vertical-align: top;
  }

  .diff-key {
    font-family: monospace;
    color: var(--color-text);
    white-space: nowrap;
    width: 1%;
  }

  .diff-val {
    font-family: monospace;
    word-break: break-all;
    max-width: 200px;
  }

  .diff-row.added .diff-val.after {
    color: #22c55e;
    background: rgba(34, 197, 94, 0.06);
  }
  .diff-row.removed .diff-val.before {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.06);
  }
  .diff-row.changed .diff-val.before {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.04);
  }
  .diff-row.changed .diff-val.after {
    color: #22c55e;
    background: rgba(34, 197, 94, 0.04);
  }
  .diff-row.unchanged td {
    opacity: 0.5;
  }

  .unchanged-toggle {
    display: block;
    width: 100%;
    padding: 4px;
    margin-top: 4px;
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    font-size: var(--font-10);
    cursor: pointer;
    text-align: center;
  }
  .unchanged-toggle:hover {
    color: var(--color-text);
  }

  .unchanged-table {
    margin-top: 4px;
  }
</style>
