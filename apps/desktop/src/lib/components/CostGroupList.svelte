<script lang="ts">
  import { t } from '$lib/i18n';
  import type { CostGroup } from '$lib/stores/cost.svelte';
  import { ui } from '$lib/stores/ui.svelte';

  let {
    groups,
    expandedIds,
    onToggle,
    totalMonthly,
  }: {
    groups: CostGroup[];
    expandedIds: Set<string>;
    onToggle: (id: string) => void;
    totalMonthly: number | null;
  } = $props();

  function formatCost(value: number | null): string {
    if (value === null) return '—';
    if (value === 0) return t('cost.panel.free');
    return `~$${value.toFixed(2)}${t('cost.panel.perMonth')}`;
  }

  function formatCostShort(value: number | null): string {
    if (value === null) return '—';
    if (value === 0) return t('cost.panel.free');
    if (value < 10) return `~$${value.toFixed(2)}`;
    return `~$${Math.round(value)}`;
  }

  function navigateToNode(nodeId: string) {
    ui.navigateToNode(nodeId);
  }
</script>

<div class="group-list">
  {#each groups as group (group.id)}
    {@const pct = totalMonthly ? Math.round((group.subtotal / totalMonthly) * 100) : 0}
    {@const isExpanded = expandedIds.has(group.id)}
    <div class="group-section">
      <button
        class="group-header"
        aria-expanded={isExpanded}
        onclick={() => onToggle(group.id)}
      >
        <svg class="chevron" class:expanded={isExpanded} width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 2l4 4-4 4"/>
        </svg>
        <span class="group-label">
          {group.label}
          {#if group.templateName}
            <span class="group-subtitle">{group.templateName}</span>
          {/if}
        </span>
        {#if group.hasUsageBased}
          <span class="usage-hint" title="Contains usage-based resources">*</span>
        {/if}
        <span class="group-count">{group.members.length}</span>
        <span class="group-pct">{pct}%</span>
        <span class="group-cost">{formatCostShort(group.subtotal || null)}</span>
      </button>

      {#if isExpanded}
        <div class="group-members">
          {#each group.members as est (est.nodeId)}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div class="resource-row" onclick={() => navigateToNode(est.nodeId)} title="Click to navigate">
              <span class="resource-name" title={est.typeId}>{est.displayName}</span>
              <span class="resource-cost" class:free={est.monthlyCost === 0} class:usage={est.monthlyCost === null}>
                {formatCost(est.monthlyCost)}
              </span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/each}

  {#if groups.length === 0}
    <div class="empty-hint">{t('cost.panel.noGroups')}</div>
  {/if}
</div>

<style>
  .group-list {
    display: flex;
    flex-direction: column;
  }

  .group-section {
    border-top: 1px solid var(--color-border);
  }
  .group-section:first-child {
    border-top: none;
  }

  .group-header {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 6px 0;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    color: var(--color-text);
    font-size: var(--font-11);
    transition: background 0.1s;
  }
  .group-header:hover {
    background: var(--color-surface-hover);
    border-radius: 3px;
  }

  .chevron {
    flex-shrink: 0;
    transition: transform 0.15s;
  }
  .chevron.expanded {
    transform: rotate(90deg);
  }

  .group-label {
    flex: 1;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .group-subtitle {
    font-weight: 400;
    font-size: var(--font-10);
    color: var(--color-text-muted);
    margin-left: 4px;
  }

  .group-count {
    font-size: var(--font-9);
    color: var(--color-text-muted);
    background: var(--color-surface);
    border-radius: 8px;
    padding: 0 5px;
    min-width: 16px;
    text-align: center;
    line-height: 16px;
  }

  .usage-hint {
    color: var(--color-text-muted);
    font-size: var(--font-10);
  }

  .group-pct {
    font-size: var(--font-10);
    color: var(--color-text-muted);
    min-width: 28px;
    text-align: right;
  }

  .group-cost {
    font-size: var(--font-11);
    font-weight: 600;
    color: var(--color-accent);
    min-width: 64px;
    text-align: right;
  }

  .group-members {
    padding-bottom: 4px;
  }

  .resource-row {
    display: flex;
    align-items: center;
    padding: 3px 0 3px 20px;
    gap: 6px;
    cursor: pointer;
  }
  .resource-row:hover {
    background: var(--color-surface-hover);
    border-radius: 3px;
  }

  .resource-name {
    flex: 1;
    font-size: var(--font-11);
    color: var(--color-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .resource-cost {
    font-size: var(--font-11);
    color: var(--color-text);
    min-width: 64px;
    text-align: right;
    flex-shrink: 0;
  }
  .resource-cost.free { color: #22c55e; }
  .resource-cost.usage { color: var(--color-text-muted); font-style: italic; }

  .empty-hint {
    padding: 12px 0;
    font-size: var(--font-11);
    color: var(--color-text-muted);
    text-align: center;
  }
</style>
