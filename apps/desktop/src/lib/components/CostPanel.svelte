<script lang="ts">
  import { cost, AZURE_REGIONS } from '$lib/stores/cost.svelte';
  import { diagram } from '$lib/stores/diagram.svelte';
  import { project } from '$lib/stores/project.svelte';
  import CollapsibleSection from './CollapsibleSection.svelte';

  let showRegionPicker = $state(false);

  const nodes = $derived(diagram.nodes);

  async function handleFetch() {
    if (!nodes.length) return;
    showRegionPicker = false;
    await cost.fetchAll(nodes);
  }

  function handleExportCsv() {
    const csv = cost.exportCsv(nodes);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name ?? 'terrastudio'}-cost-estimate.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function formatCost(value: number | null): string {
    if (value === null) return '—';
    if (value === 0) return 'Free';
    return `~$${value.toFixed(2)}/mo`;
  }

  function formatCostShort(value: number | null): string {
    if (value === null) return '—';
    if (value === 0) return 'Free';
    if (value < 10) return `~$${value.toFixed(2)}`;
    return `~$${Math.round(value)}`;
  }

  // Group estimates by resource category (middle segment of typeId)
  const groupedEstimates = $derived.by(() => {
    const groups = new Map<string, { category: string; items: typeof estimateList }>();
    for (const est of estimateList) {
      const parts = est.typeId.split('/');
      const category = parts[1] ?? 'other';
      const label = category.charAt(0).toUpperCase() + category.slice(1);
      if (!groups.has(category)) groups.set(category, { category: label, items: [] });
      groups.get(category)!.items.push(est);
    }
    return Array.from(groups.values()).sort((a, b) => {
      const totalA = a.items.reduce((s, i) => s + (i.monthlyCost ?? 0), 0);
      const totalB = b.items.reduce((s, i) => s + (i.monthlyCost ?? 0), 0);
      return totalB - totalA;
    });
  });

  const estimateList = $derived(Array.from(cost.estimates.values()));

  const knownTotal = $derived.by(() => {
    let t = 0;
    for (const est of estimateList) {
      if (est.monthlyCost !== null) t += est.monthlyCost;
    }
    return t;
  });

  const usageBasedCount = $derived(
    estimateList.filter((e) => e.monthlyCost === null && !e.loading).length
  );

  const regionLabel = $derived(
    AZURE_REGIONS.find((r) => r.value === cost.region)?.label ?? cost.region
  );
</script>

<div class="cost-panel">
  <!-- Action bar -->
  <div class="action-bar">
    <button
      class="fetch-btn"
      onclick={handleFetch}
      disabled={cost.loading || !nodes.length}
      title={!nodes.length ? 'Add resources to the canvas first' : 'Fetch pricing from Azure Retail Prices API'}
    >
      {#if cost.loading}
        <svg class="spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" stroke-linecap="round"/>
        </svg>
        Fetching…
      {:else}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        Fetch Prices
      {/if}
    </button>
    <div class="region-wrapper">
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        class="region-chip"
        onclick={() => { showRegionPicker = !showRegionPicker; }}
        title="Fallback region — used when a resource has no location set on it or its Resource Group"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        {regionLabel}
        <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 4l4 4 4-4"/>
        </svg>
      </div>
      {#if showRegionPicker}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="region-dropdown" onmouseleave={() => { showRegionPicker = false; }}>
          {#each AZURE_REGIONS as r}
            <button
              class="region-option"
              class:active={cost.region === r.value}
              onclick={() => { cost.setRegion(r.value); showRegionPicker = false; }}
            >
              {r.label}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  {#if !cost.hasPrices && !cost.loading}
    <div class="empty-state">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" opacity="0.3">
        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
      <p>Click <strong>Fetch Prices</strong> to get Azure cost estimates for your resources.</p>
      <p class="note">Uses the public Azure Retail Prices API. No sign-in required.</p>
    </div>
  {:else}
    <!-- Summary section -->
    <CollapsibleSection id="cost-summary" label="Summary">
      <div class="summary-grid">
        <span class="summary-label">Est. monthly</span>
        <span class="summary-value highlight">
          {cost.totalMonthly !== null ? `~$${cost.totalMonthly.toFixed(2)}/mo` : '—'}
        </span>
        <span class="summary-label">Resources priced</span>
        <span class="summary-value">{cost.pricedCount} / {estimateList.length}</span>
        {#if usageBasedCount > 0}
          <span class="summary-label">Usage-based</span>
          <span class="summary-value muted">{usageBasedCount} resource{usageBasedCount !== 1 ? 's' : ''}</span>
        {/if}
        {#if cost.lastFetched}
          <span class="summary-label">Last updated</span>
          <span class="summary-value muted">{cost.formatRelativeTime()}</span>
        {/if}
      </div>
      <button class="export-btn" onclick={handleExportCsv} disabled={!cost.hasPrices}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Export CSV
      </button>
    </CollapsibleSection>

    <!-- By resource type -->
    <CollapsibleSection id="cost-by-type" label="By Resource Type" count={groupedEstimates.length}>
      <div class="breakdown-list">
        {#each groupedEstimates as group}
          {@const groupTotal = group.items.reduce((s, i) => s + (i.monthlyCost ?? 0), 0)}
          {@const pct = cost.totalMonthly ? Math.round((groupTotal / cost.totalMonthly) * 100) : 0}
          <div class="group-header-row">
            <span class="group-label">{group.category}</span>
            <span class="group-pct">{pct}%</span>
            <span class="group-cost">{formatCostShort(groupTotal || null)}</span>
          </div>
          {#each group.items as est}
            <div class="resource-row">
              {#if est.loading}
                <span class="resource-name">{est.displayName}</span>
                <span class="resource-cost loading">…</span>
              {:else}
                <span class="resource-name" title={est.typeId}>{est.displayName}</span>
                <span class="resource-cost" class:free={est.monthlyCost === 0} class:usage={est.monthlyCost === null}>
                  {formatCost(est.monthlyCost)}
                </span>
              {/if}
            </div>
          {/each}
        {/each}
      </div>
    </CollapsibleSection>

    <!-- Notes -->
    <CollapsibleSection id="cost-notes" label="Notes">
      <ul class="notes-list">
        <li>Estimates use pay-as-you-go retail pricing.</li>
        <li>Each resource uses its own <strong>location</strong> property, or inherits from its parent Resource Group.</li>
        <li>The globe icon sets a fallback region for resources with no location configured.</li>
        <li>Excludes egress, support plans, and reserved instance discounts.</li>
        <li>Usage-based resources (Consumption plan, CosmosDB) cannot be estimated.</li>
        <li>Storage assumes ~100 GB for calculation.</li>
        <li>Prices cached locally for 24 hours.</li>
      </ul>
    </CollapsibleSection>
  {/if}
</div>

<style>
  .cost-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  /* Action bar */
  .action-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .fetch-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 500;
    background: var(--color-accent);
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: opacity 0.15s;
    flex-shrink: 0;
  }
  .fetch-btn:hover:not(:disabled) { opacity: 0.85; }
  .fetch-btn:disabled { opacity: 0.45; cursor: not-allowed; }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .spin { animation: spin 0.8s linear infinite; }

  .region-wrapper {
    position: relative;
    flex: 1;
    min-width: 0;
  }

  .region-chip {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 7px;
    font-size: 10px;
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    cursor: pointer;
    transition: border-color 0.1s, color 0.1s;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .region-chip:hover {
    border-color: var(--color-accent);
    color: var(--color-text);
  }

  .region-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    z-index: 100;
    max-height: 200px;
    overflow-y: auto;
    padding: 4px;
  }

  .region-option {
    display: block;
    width: 100%;
    text-align: left;
    padding: 5px 8px;
    font-size: 11px;
    color: var(--color-text-muted);
    background: none;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
  }
  .region-option:hover, .region-option.active {
    background: var(--color-accent);
    color: #fff;
  }

  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 10px;
    padding: 32px 20px;
    color: var(--color-text-muted);
    font-size: 12px;
    line-height: 1.5;
  }
  .empty-state strong { color: var(--color-text); }
  .empty-state .note { font-size: 10px; opacity: 0.6; }

  /* Summary grid */
  .summary-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
    font-size: 11px;
    margin-bottom: 10px;
  }
  .summary-label { color: var(--color-text-muted); }
  .summary-value { color: var(--color-text); font-weight: 500; }
  .summary-value.highlight { color: var(--color-accent); font-size: 13px; font-weight: 600; }
  .summary-value.muted { color: var(--color-text-muted); font-weight: 400; }

  .export-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    font-size: 11px;
    background: transparent;
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    cursor: pointer;
    transition: border-color 0.1s, color 0.1s;
    margin-top: 2px;
  }
  .export-btn:hover:not(:disabled) {
    border-color: var(--color-accent);
    color: var(--color-text);
  }
  .export-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* Breakdown list */
  .breakdown-list {
    display: flex;
    flex-direction: column;
  }

  .group-header-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 0 2px;
    border-top: 1px solid var(--color-border);
    margin-top: 4px;
  }
  .group-header-row:first-child { border-top: none; margin-top: 0; }
  .group-label {
    flex: 1;
    font-size: 11px;
    font-weight: 600;
    color: var(--color-text);
  }
  .group-pct {
    font-size: 10px;
    color: var(--color-text-muted);
    min-width: 28px;
    text-align: right;
  }
  .group-cost {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-accent);
    min-width: 64px;
    text-align: right;
  }

  .resource-row {
    display: flex;
    align-items: center;
    padding: 3px 0 3px 10px;
    gap: 6px;
  }
  .resource-row:hover { background: var(--color-surface-hover); border-radius: 3px; }

  .resource-name {
    flex: 1;
    font-size: 11px;
    color: var(--color-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .resource-cost {
    font-size: 11px;
    color: var(--color-text);
    min-width: 64px;
    text-align: right;
    flex-shrink: 0;
  }
  .resource-cost.free { color: #22c55e; }
  .resource-cost.usage { color: var(--color-text-muted); font-style: italic; }
  .resource-cost.loading { color: var(--color-text-muted); opacity: 0.5; }

  /* Notes */
  .notes-list {
    margin: 0;
    padding-left: 16px;
    font-size: 10px;
    color: var(--color-text-muted);
    line-height: 1.7;
    opacity: 0.8;
  }
</style>
