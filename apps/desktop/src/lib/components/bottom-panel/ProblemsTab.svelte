<script lang="ts">
  import { validation } from '$lib/stores/validation.svelte';
  import { navigateToProblem } from '$lib/services/problem-navigation';
  import { registry } from '$lib/bootstrap';
  import { t } from '$lib/i18n';
  import type { ProblemEntry, ProblemsGroup } from '$lib/stores/validation.svelte';

  let severityFilter = $state<'all' | 'errors' | 'warnings'>('all');
  let sourceFilter = $state<'all-sources' | 'validation' | 'terraform'>('all-sources');
  let searchText = $state('');

  let filteredGroups = $derived.by((): ProblemsGroup[] => {
    let groups = validation.groups;

    // Apply source filter
    if (sourceFilter !== 'all-sources') {
      groups = groups
        .map((g) => {
          const filtered = g.problems.filter((p) =>
            (p.source ?? 'validation') === sourceFilter,
          );
          if (filtered.length === 0) return null;
          return {
            ...g,
            problems: filtered,
            errorCount: filtered.filter((p) => p.severity === 'error').length,
            warningCount: filtered.filter((p) => p.severity === 'warning').length,
          };
        })
        .filter((g): g is ProblemsGroup => g !== null);
    }

    // Apply severity filter
    if (severityFilter !== 'all') {
      groups = groups
        .map((g) => {
          const filtered = g.problems.filter((p) =>
            severityFilter === 'errors' ? p.severity === 'error' : p.severity === 'warning',
          );
          if (filtered.length === 0) return null;
          return {
            ...g,
            problems: filtered,
            errorCount: filtered.filter((p) => p.severity === 'error').length,
            warningCount: filtered.filter((p) => p.severity === 'warning').length,
          };
        })
        .filter((g): g is ProblemsGroup => g !== null);
    }

    // Apply search filter
    if (searchText.trim()) {
      const query = searchText.toLowerCase();
      groups = groups
        .map((g) => {
          const filtered = g.problems.filter(
            (p) =>
              p.message.toLowerCase().includes(query) ||
              p.resourceLabel.toLowerCase().includes(query) ||
              p.propertyKey.toLowerCase().includes(query) ||
              (p.detail?.toLowerCase().includes(query) ?? false),
          );
          if (filtered.length === 0) return null;
          return {
            ...g,
            problems: filtered,
            errorCount: filtered.filter((p) => p.severity === 'error').length,
            warningCount: filtered.filter((p) => p.severity === 'warning').length,
          };
        })
        .filter((g): g is ProblemsGroup => g !== null);
    }

    return groups;
  });

  let collapsedGroups = $state<Set<string>>(new Set());

  function toggleGroup(instanceId: string) {
    const next = new Set(collapsedGroups);
    if (next.has(instanceId)) {
      next.delete(instanceId);
    } else {
      next.add(instanceId);
    }
    collapsedGroups = next;
  }

  function getResourceIcon(typeId: string): string | null {
    const icon = registry.getIcon(typeId as any);
    return icon?.svg ?? null;
  }

  function handleProblemClick(problem: ProblemEntry) {
    navigateToProblem(problem);
  }
</script>

<div class="problems-tab">
  <!-- Filter bar -->
  <div class="filter-bar">
    <div class="severity-buttons">
      <button
        class="severity-btn"
        class:active={severityFilter === 'all'}
        onclick={() => { severityFilter = 'all'; }}
      >
        {t('problems.all')}
        {#if validation.errorCount + validation.warningCount > 0}
          <span class="count-badge">{validation.errorCount + validation.warningCount}</span>
        {/if}
      </button>
      <button
        class="severity-btn error-btn"
        class:active={severityFilter === 'errors'}
        onclick={() => { severityFilter = 'errors'; }}
      >
        <svg class="severity-icon error" width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="8" r="7" />
          <text x="8" y="12" text-anchor="middle" fill="var(--color-bg)" font-size="11" font-weight="bold">&times;</text>
        </svg>
        {validation.errorCount}
      </button>
      <button
        class="severity-btn warning-btn"
        class:active={severityFilter === 'warnings'}
        onclick={() => { severityFilter = 'warnings'; }}
      >
        <svg class="severity-icon warning" width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1L15 14H1L8 1z" />
          <text x="8" y="13" text-anchor="middle" fill="var(--color-bg)" font-size="9" font-weight="bold">!</text>
        </svg>
        {validation.warningCount}
      </button>
      {#if validation.hasTerraformProblems}
        <span class="filter-separator"></span>
        <button
          class="severity-btn source-btn"
          class:active={sourceFilter === 'validation'}
          onclick={() => { sourceFilter = sourceFilter === 'validation' ? 'all-sources' : 'validation'; }}
        >
          {t('problems.sourceValidation')}
        </button>
        <button
          class="severity-btn source-btn tf-btn"
          class:active={sourceFilter === 'terraform'}
          onclick={() => { sourceFilter = sourceFilter === 'terraform' ? 'all-sources' : 'terraform'; }}
        >
          {t('problems.sourceTerraform')}
        </button>
      {/if}
    </div>
    <input
      type="text"
      class="search-input"
      placeholder={t('problems.searchPlaceholder')}
      bind:value={searchText}
    />
  </div>

  <!-- Content -->
  <div class="problems-list">
    {#if validation.pending && validation.problems.length === 0}
      <div class="empty-state">
        <span class="empty-text">{t('problems.validating')}</span>
      </div>
    {:else if !validation.pending && validation.problems.length === 0}
      <div class="empty-state">
        <svg class="empty-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <span class="empty-title">{t('problems.noProblems')}</span>
        <span class="empty-text">{t('problems.noProblemsHint')}</span>
      </div>
    {:else if filteredGroups.length === 0}
      <div class="empty-state">
        <span class="empty-text">{t('problems.noMatch')}</span>
      </div>
    {:else}
      {#each filteredGroups as group (group.instanceId)}
        {@const isCollapsed = collapsedGroups.has(group.instanceId)}
        <div class="problem-group">
          <button class="group-header" onclick={() => toggleGroup(group.instanceId)}>
            <svg class="chevron" class:collapsed={isCollapsed} width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="4 6 8 10 12 6" />
            </svg>
            {#if group.instanceId === '_terraform_general'}
              <span class="resource-icon terraform-icon">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="4 12 1 10 1 2 4 4" />
                  <polyline points="12 12 15 10 15 2 12 4" />
                  <rect x="4" y="1" width="8" height="14" rx="1" />
                  <line x1="7" y1="5" x2="9" y2="5" />
                  <line x1="7" y1="8" x2="9" y2="8" />
                </svg>
              </span>
            {:else if getResourceIcon(group.typeId)}
              <span class="resource-icon">{@html getResourceIcon(group.typeId)}</span>
            {/if}
            <span class="group-label">{group.resourceLabel}</span>
            <span class="group-counts">
              {#if group.errorCount > 0}
                <span class="count-error">{group.errorCount}</span>
              {/if}
              {#if group.warningCount > 0}
                <span class="count-warning">{group.warningCount}</span>
              {/if}
            </span>
          </button>
          {#if !isCollapsed}
            <div class="group-items">
              {#each group.problems as problem ((problem.source ?? 'validation') + ':' + problem.propertyKey + ':' + problem.message)}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="problem-item" onclick={() => handleProblemClick(problem)}>
                  {#if problem.severity === 'error'}
                    <svg class="problem-severity error" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <circle cx="8" cy="8" r="7" />
                      <text x="8" y="12" text-anchor="middle" fill="var(--color-bg)" font-size="11" font-weight="bold">&times;</text>
                    </svg>
                  {:else}
                    <svg class="problem-severity warning" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 1L15 14H1L8 1z" />
                      <text x="8" y="13" text-anchor="middle" fill="var(--color-bg)" font-size="9" font-weight="bold">!</text>
                    </svg>
                  {/if}
                  {#if problem.source === 'terraform'}
                    <span class="tf-badge">TF</span>
                  {/if}
                  <span class="problem-key">{problem.propertyKey}</span>
                  <div class="problem-text">
                    <span class="problem-message">{problem.message}</span>
                    {#if problem.detail}
                      <span class="problem-detail">{problem.detail}</span>
                    {/if}
                  </div>
                  {#if problem.quickFix && problem.source !== 'terraform'}
                    <button
                      class="quick-fix-btn"
                      onclick={(e: MouseEvent) => { e.stopPropagation(); problem.quickFix?.apply(problem.instanceId, problem.propertyKey); }}
                      title={problem.quickFix.label}
                    >
                      {t('problems.fix')}
                    </button>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .problems-tab {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  .filter-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }
  .severity-buttons {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .filter-separator {
    width: 1px;
    height: 14px;
    background: var(--color-border);
    margin: 0 4px;
    flex-shrink: 0;
  }
  .severity-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    height: 22px;
    border: 1px solid transparent;
    border-radius: 3px;
    background: none;
    color: var(--color-text-muted);
    font-size: var(--font-11);
    cursor: pointer;
    white-space: nowrap;
  }
  .severity-btn:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }
  .severity-btn.active {
    background: var(--color-surface-hover);
    color: var(--color-text);
    border-color: var(--color-border);
  }
  .source-btn {
    font-size: var(--font-10);
    padding: 2px 6px;
  }
  .tf-btn.active {
    background: rgba(139, 92, 246, 0.15);
    color: #a78bfa;
    border-color: rgba(139, 92, 246, 0.3);
  }
  .severity-icon.error {
    color: #ef4444;
  }
  .severity-icon.warning {
    color: #f59e0b;
  }
  .count-badge {
    font-size: var(--font-10);
    padding: 0 4px;
    border-radius: 8px;
    background: var(--color-border);
    color: var(--color-text);
    min-width: 16px;
    text-align: center;
  }
  .search-input {
    flex: 1;
    padding: 2px 8px;
    height: 22px;
    border: 1px solid var(--color-border);
    border-radius: 3px;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: var(--font-11);
    outline: none;
    min-width: 80px;
  }
  .search-input:focus {
    border-color: var(--color-accent);
  }
  .problems-list {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 6px;
    padding: 24px;
    min-height: 80px;
  }
  .empty-icon {
    color: var(--color-text-muted);
    opacity: 0.3;
  }
  .empty-title {
    font-size: var(--font-12);
    color: var(--color-text-muted);
    font-weight: 500;
  }
  .empty-text {
    font-size: var(--font-11);
    color: var(--color-text-muted);
    opacity: 0.6;
  }
  .problem-group {
    border-bottom: 1px solid var(--color-border);
  }
  .group-header {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 4px 8px;
    background: var(--color-surface);
    border: none;
    color: var(--color-text);
    font-size: var(--font-12);
    font-weight: 500;
    cursor: pointer;
    text-align: left;
  }
  .group-header:hover {
    background: var(--color-surface-hover);
  }
  .chevron {
    flex-shrink: 0;
    transition: transform 0.15s;
  }
  .chevron.collapsed {
    transform: rotate(-90deg);
  }
  .resource-icon {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }
  .resource-icon :global(svg) {
    width: 14px;
    height: 14px;
  }
  .terraform-icon {
    color: var(--color-text-muted);
  }
  .group-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .group-counts {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }
  .count-error {
    font-size: var(--font-10);
    padding: 0 5px;
    border-radius: 8px;
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
    font-weight: 600;
  }
  .count-warning {
    font-size: var(--font-10);
    padding: 0 5px;
    border-radius: 8px;
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
    font-weight: 600;
  }
  .group-items {
    background: var(--color-bg);
  }
  .problem-item {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    width: 100%;
    padding: 3px 8px 3px 28px;
    border: none;
    background: none;
    color: var(--color-text);
    font-size: var(--font-12);
    cursor: pointer;
    text-align: left;
  }
  .problem-item:hover {
    background: var(--color-surface-hover);
  }
  .problem-severity.error {
    color: #ef4444;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .problem-severity.warning {
    color: #f59e0b;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .tf-badge {
    font-size: 9px;
    font-weight: 700;
    padding: 0 4px;
    border-radius: 3px;
    background: rgba(139, 92, 246, 0.15);
    color: #a78bfa;
    flex-shrink: 0;
    line-height: 16px;
    margin-top: 1px;
  }
  .problem-key {
    color: var(--color-accent);
    font-size: var(--font-11);
    font-family: 'Cascadia Code', 'Fira Code', monospace;
    flex-shrink: 0;
  }
  .problem-text {
    flex: 1;
    overflow: hidden;
    min-width: 0;
  }
  .problem-message {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-muted);
    font-size: var(--font-11);
  }
  .problem-detail {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-muted);
    font-size: var(--font-10);
    opacity: 0.6;
    margin-top: 1px;
  }
  .quick-fix-btn {
    padding: 1px 6px;
    border: 1px solid var(--color-border);
    border-radius: 3px;
    background: none;
    color: var(--color-accent);
    font-size: var(--font-10);
    cursor: pointer;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.1s;
  }
  .problem-item:hover .quick-fix-btn {
    opacity: 1;
  }
  .quick-fix-btn:hover {
    background: var(--color-surface-hover);
    border-color: var(--color-accent);
  }
</style>
