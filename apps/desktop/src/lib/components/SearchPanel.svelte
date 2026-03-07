<script lang="ts">
  import { onMount } from 'svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import { diagram } from '$lib/stores/diagram.svelte';
  import { registry } from '$lib/bootstrap';
  import { searchNodes, type SearchResult } from '$lib/services/search-service';

  let results = $state<SearchResult[]>([]);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let inputEl = $state<HTMLInputElement | null>(null);

  // Focus input when view becomes active
  $effect(() => {
    if (ui.activeView === 'search') {
      setTimeout(() => inputEl?.focus(), 50);
    }
  });

  // Restore results once on mount if there's an existing query (after view switch)
  onMount(() => {
    if (ui.searchQuery.trim().length >= 2) {
      runSearch();
    }
  });

  function runSearch() {
    const q = ui.searchQuery.trim();
    if (q.length < 2) {
      results = [];
      ui.searchResultCount = 0;
      return;
    }

    results = searchNodes({
      query: q,
      mode: ui.searchMode,
      filters: {
        provider: ui.searchProviderFilter || undefined,
        deploymentStatus: ui.searchStatusFilter || undefined,
      },
      nodes: diagram.nodes,
      getSchema: (typeId) => registry.getResourceSchema(typeId as any),
    });

    ui.searchResultCount = results.length;
    ui.searchActiveIndex = results.length > 0 ? 0 : -1;
  }

  function onInput() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runSearch, 150);
  }

  function onFilterChange() {
    runSearch();
  }

  function clearSearch() {
    ui.searchQuery = '';
    results = [];
    ui.searchResultCount = 0;
    ui.searchActiveIndex = -1;
    inputEl?.focus();
  }

  function navigateToResult(index: number) {
    if (index < 0 || index >= results.length) return;
    ui.searchActiveIndex = index;
    ui.navigateToNode(results[index].nodeId);
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length > 0) {
        ui.searchActiveIndex = (ui.searchActiveIndex + 1) % results.length;
        scrollActiveIntoView();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length > 0) {
        ui.searchActiveIndex = ui.searchActiveIndex <= 0 ? results.length - 1 : ui.searchActiveIndex - 1;
        scrollActiveIntoView();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      navigateToResult(ui.searchActiveIndex);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      inputEl?.blur();
    }
  }

  function scrollActiveIntoView() {
    setTimeout(() => {
      const el = document.querySelector('.search-result-row.active');
      el?.scrollIntoView({ block: 'nearest' });
    }, 0);
  }

  function highlightMatch(text: string, q: string): string {
    if (!q || q.length < 2) return escapeHtml(text);
    const lower = text.toLowerCase();
    const idx = lower.indexOf(q.toLowerCase());
    if (idx === -1) return escapeHtml(text);
    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + q.length);
    const after = text.slice(idx + q.length);
    return `${escapeHtml(before)}<mark>${escapeHtml(match)}</mark>${escapeHtml(after)}`;
  }

  function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  const matchFieldLabels: Record<string, string> = {
    'label': 'name',
    'terraform-name': 'terraform name',
    'type': 'type',
    'property': 'property',
  };
</script>

<div class="search-panel" onkeydown={onKeydown}>
  <div class="search-bar">
    <div class="search-input-row">
      <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        bind:this={inputEl}
        bind:value={ui.searchQuery}
        oninput={onInput}
        type="text"
        placeholder="Search resources..."
        class="search-input"
        spellcheck="false"
      />
      {#if ui.searchQuery}
        <button class="clear-btn" onclick={clearSearch} title="Clear">&#215;</button>
      {/if}
    </div>
  </div>

  <div class="search-filters">
    <label class="filter-group">
      <span class="filter-label">Mode</span>
      <select bind:value={ui.searchMode} onchange={onFilterChange}>
        <option value="all">All Fields</option>
        <option value="name">Name</option>
        <option value="type">Type</option>
        <option value="terraform-name">Terraform Name</option>
        <option value="property">Property</option>
      </select>
    </label>
    <label class="filter-group">
      <span class="filter-label">Provider</span>
      <select bind:value={ui.searchProviderFilter} onchange={onFilterChange}>
        <option value="">All</option>
        <option value="azurerm">Azure</option>
        <option value="aws">AWS</option>
      </select>
    </label>
    <label class="filter-group">
      <span class="filter-label">Status</span>
      <select bind:value={ui.searchStatusFilter} onchange={onFilterChange}>
        <option value="">All</option>
        <option value="created">Created</option>
        <option value="failed">Failed</option>
        <option value="pending">Pending</option>
        <option value="creating">Creating</option>
        <option value="updating">Updating</option>
        <option value="destroyed">Destroyed</option>
      </select>
    </label>
  </div>

  {#if results.length > 0}
    <div class="result-count-bar">
      {results.length} result{results.length === 1 ? '' : 's'}
    </div>
  {/if}

  <div class="search-results">
    {#if ui.searchQuery.length >= 2 && results.length === 0}
      <div class="empty-state">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.4">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span>No results for &ldquo;{ui.searchQuery}&rdquo;</span>
      </div>
    {:else if ui.searchQuery.length === 0}
      <div class="empty-state">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.4">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span>Search resources on canvas</span>
      </div>
    {:else if ui.searchQuery.length < 2}
      <div class="empty-state">
        <span>Type at least 2 characters</span>
      </div>
    {:else}
      {#each results as result, i (result.nodeId)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="search-result-row"
          class:active={i === ui.searchActiveIndex}
          onclick={() => navigateToResult(i)}
        >
          <div class="result-main">
            <span class="result-label">{@html highlightMatch(result.label, ui.searchQuery)}</span>
          </div>
          <div class="result-meta">
            <span class="result-type">{result.typeName}</span>
            <span class="result-sep">&middot;</span>
            <span class="result-tf-name">{result.terraformName}</span>
          </div>
          <div class="result-match-info">
            Matched: {matchFieldLabels[result.matchedField] ?? result.matchedField}
            {#if result.matchedField === 'property' && result.matchedPropertyLabel}
              ({result.matchedPropertyLabel})
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .search-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }
  .search-bar {
    padding: 8px 10px;
    flex-shrink: 0;
  }
  .search-input-row {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    padding: 0 8px;
    height: 28px;
  }
  .search-input-row:focus-within {
    border-color: var(--color-accent);
  }
  .search-icon {
    flex-shrink: 0;
    opacity: 0.5;
  }
  .search-input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    color: var(--color-text);
    font-size: 12px;
    font-family: inherit;
    min-width: 0;
  }
  .search-input::placeholder {
    color: var(--color-text-muted);
    opacity: 0.6;
  }
  .clear-btn {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 16px;
    cursor: pointer;
    padding: 0 2px;
    line-height: 1;
  }
  .clear-btn:hover {
    color: var(--color-text);
  }
  .search-filters {
    padding: 0 10px 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--color-border);
  }
  .filter-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .filter-label {
    font-size: 11px;
    color: var(--color-text-muted);
    min-width: 52px;
  }
  .filter-group select {
    flex: 1;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 3px;
    color: var(--color-text);
    font-size: 11px;
    padding: 1px 4px;
    height: 22px;
    cursor: pointer;
  }
  .result-count-bar {
    padding: 4px 10px;
    font-size: 11px;
    color: var(--color-text-muted);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }
  .search-results {
    flex: 1;
    overflow-y: auto;
  }
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 32px 16px;
    color: var(--color-text-muted);
    font-size: 12px;
    opacity: 0.6;
  }
  .search-result-row {
    padding: 6px 10px;
    cursor: pointer;
    border-left: 2px solid transparent;
  }
  .search-result-row:hover {
    background: var(--color-surface-hover);
  }
  .search-result-row.active {
    background: var(--color-surface-hover);
    border-left-color: var(--color-accent);
  }
  .result-main {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .result-label {
    font-size: 12px;
    color: var(--color-text);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .result-label :global(mark) {
    background: rgba(129, 140, 248, 0.3);
    color: inherit;
    border-radius: 1px;
    padding: 0 1px;
  }
  .result-meta {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 1px;
  }
  .result-type {
    font-size: 11px;
    color: var(--color-text-muted);
  }
  .result-sep {
    font-size: 10px;
    color: var(--color-text-muted);
    opacity: 0.4;
  }
  .result-tf-name {
    font-size: 11px;
    color: var(--color-text-muted);
    font-family: monospace;
    opacity: 0.7;
  }
  .result-match-info {
    font-size: 10px;
    color: var(--color-text-muted);
    opacity: 0.5;
    margin-top: 1px;
  }
</style>
