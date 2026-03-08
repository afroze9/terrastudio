<script lang="ts">
  import { plan, type PlanResourceChange } from '$lib/stores/plan.svelte';
  import { diagram } from '$lib/stores/diagram.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import { applyFromPlan } from '$lib/services/terraform-service';
  import { terraform } from '$lib/stores/terraform.svelte';

  let creates = $derived((plan.planResult?.planChanges ?? []).filter((c) => c.action === 'create'));
  let updates = $derived((plan.planResult?.planChanges ?? []).filter((c) => c.action === 'update'));
  let deletes = $derived((plan.planResult?.planChanges ?? []).filter((c) => c.action === 'delete'));
  let replaces = $derived((plan.planResult?.planChanges ?? []).filter((c) => c.action === 'replace'));
  let noops = $derived((plan.planResult?.planChanges ?? []).filter((c) => c.action === 'no-op' || c.action === 'read'));

  let expandedAddr = $state<string | null>(null);

  function toggleExpand(addr: string) {
    expandedAddr = expandedAddr === addr ? null : addr;
  }

  function jumpToNode(change: PlanResourceChange) {
    // Find the node ID for this change address
    for (const [nodeId, ch] of plan.nodeChangeMap) {
      if (ch.address === change.address) {
        diagram.selectedNodeId = nodeId;
        ui.activeTabId = 'canvas';
        return;
      }
    }
  }

  function actionIcon(action: string): string {
    switch (action) {
      case 'create': return '+';
      case 'update': return '~';
      case 'delete': return '-';
      case 'replace': return '!';
      default: return ' ';
    }
  }

  function actionColor(action: string): string {
    switch (action) {
      case 'create': return '#22c55e';
      case 'update': return '#f59e0b';
      case 'delete': return '#ef4444';
      case 'replace': return '#f97316';
      default: return '#6b7280';
    }
  }

  function formatValue(val: unknown): string {
    if (val === undefined || val === null) return '-';
    if (typeof val === 'string') return val.length > 60 ? val.slice(0, 60) + '\u2026' : val;
    if (typeof val === 'boolean' || typeof val === 'number') return String(val);
    const json = JSON.stringify(val);
    return json.length > 60 ? json.slice(0, 60) + '\u2026' : json;
  }
</script>

{#if plan.planResult}
  <div class="plan-tab">
    <div class="plan-tab-header">
      <span class="plan-count">
        {plan.planResult.planChanges.length} resource change{plan.planResult.planChanges.length !== 1 ? 's' : ''}
      </span>
      {#if plan.active}
        <button
          class="apply-btn-small"
          onclick={() => applyFromPlan()}
          disabled={terraform.isRunning || plan.summary.toCreate + plan.summary.toUpdate + plan.summary.toDelete === 0}
        >Apply Plan</button>
      {/if}
    </div>
    <div class="change-list">
      {#each [
        { label: 'Create', changes: creates, action: 'create' },
        { label: 'Update', changes: updates, action: 'update' },
        { label: 'Replace', changes: replaces, action: 'replace' },
        { label: 'Destroy', changes: deletes, action: 'delete' },
        { label: 'No-op / Read', changes: noops, action: 'no-op' },
      ] as group}
        {#if group.changes.length > 0}
          <div class="change-group">
            <div class="group-header" style="color: {actionColor(group.action)};">
              {group.label} ({group.changes.length})
            </div>
            {#each group.changes as change}
              <div class="change-row">
                <button class="change-summary" onclick={() => toggleExpand(change.address)}>
                  <span class="action-icon" style="color: {actionColor(change.action)};">{actionIcon(change.action)}</span>
                  <span class="change-addr">{change.address}</span>
                  <span class="change-keys">{change.changedKeys.length} changed</span>
                </button>
                {#if plan.nodeChangeMap.has(
                  [...plan.nodeChangeMap.entries()].find(([, v]) => v.address === change.address)?.[0] ?? ''
                )}
                  <button class="jump-btn" onclick={() => jumpToNode(change)} title="Jump to node">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </button>
                {/if}
              </div>
              {#if expandedAddr === change.address}
                <div class="change-detail">
                  <table class="detail-table">
                    <thead>
                      <tr><th>Key</th><th>Before</th><th>After</th></tr>
                    </thead>
                    <tbody>
                      {#each change.changedKeys as key}
                        <tr>
                          <td class="detail-key">{key}</td>
                          <td class="detail-val before">{formatValue(change.before?.[key])}</td>
                          <td class="detail-val after">{formatValue(change.after?.[key])}</td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              {/if}
            {/each}
          </div>
        {/if}
      {/each}
    </div>
  </div>
{:else}
  <div class="placeholder-tab">
    <span class="placeholder-text">Run terraform plan to see changes</span>
  </div>
{/if}

<style>
  .plan-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .plan-tab-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .plan-count {
    font-size: var(--font-10);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
  }

  .apply-btn-small {
    padding: 2px 8px;
    font-size: var(--font-10);
    border: 1px solid #22c55e;
    border-radius: 3px;
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
    cursor: pointer;
  }
  .apply-btn-small:hover:not(:disabled) {
    background: rgba(34, 197, 94, 0.2);
  }
  .apply-btn-small:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .change-list {
    overflow-y: auto;
    flex: 1;
  }

  .change-group {
    margin-bottom: 2px;
  }

  .group-header {
    font-size: var(--font-10);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 4px 8px 2px;
  }

  .change-row {
    display: flex;
    align-items: center;
  }

  .change-summary {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    border: none;
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
    font-size: var(--font-11);
    text-align: left;
    width: 100%;
  }
  .change-summary:hover {
    background: var(--color-bg-hover, rgba(255, 255, 255, 0.05));
  }

  .action-icon {
    font-family: monospace;
    font-weight: 700;
    width: 12px;
    text-align: center;
    flex-shrink: 0;
  }

  .change-addr {
    flex: 1;
    font-family: monospace;
    font-size: var(--font-11);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .change-keys {
    color: var(--color-text-muted);
    font-size: var(--font-10);
    flex-shrink: 0;
  }

  .jump-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    border-radius: 2px;
    padding: 0;
    flex-shrink: 0;
    margin-right: 4px;
  }
  .jump-btn:hover {
    color: var(--color-accent);
    background: var(--color-bg-hover, rgba(255, 255, 255, 0.08));
  }

  .change-detail {
    padding: 2px 8px 4px 26px;
    border-bottom: 1px solid var(--color-border);
  }

  .detail-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--font-10);
  }
  .detail-table th {
    text-align: left;
    padding: 2px 6px;
    color: var(--color-text-muted);
    font-size: var(--font-9);
    text-transform: uppercase;
    border-bottom: 1px solid var(--color-border);
  }
  .detail-table td {
    padding: 2px 6px;
    font-family: monospace;
    word-break: break-all;
  }

  .detail-key {
    white-space: nowrap;
    color: var(--color-text);
  }
  .detail-val.before {
    color: #ef4444;
  }
  .detail-val.after {
    color: #22c55e;
  }

  .placeholder-tab {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    color: var(--color-text-muted);
    font-size: var(--font-12);
    opacity: 0.5;
  }
</style>
