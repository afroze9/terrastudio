<script lang="ts">
  import { git } from '$lib/stores/git.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import { project } from '$lib/stores/project.svelte';
  import { diagram } from '$lib/stores/diagram.svelte';
  import { t } from '$lib/i18n';
  import CollapsibleSection from '../CollapsibleSection.svelte';
  import { getSnapshotAtRef } from '$lib/services/git-service';
  import { computeDiagramDiff, type DiffableSnapshot } from '$lib/services/diff-engine';
  import type { ResourceDiff, ConnectionDiff, ModuleDiff, InstanceDiff } from '$lib/services/diff-engine';

  async function openWorkingDiff() {
    if (!project.path) return;
    try {
      const before = await getSnapshotAtRef(project.path, 'HEAD');
      const after: DiffableSnapshot = {
        nodes: diagram.nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data, parentId: n.parentId, width: n.measured?.width ?? n.width, height: n.measured?.height ?? n.height })),
        edges: diagram.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle, data: e.data })),
        modules: diagram.modules,
        moduleInstances: diagram.moduleInstances,
      };
      const diff = computeDiagramDiff(before, after);
      git.enterDiffMode('Working changes vs HEAD', before, after, diff);
      ui.openDiffTab('Working changes');
    } catch (e) {
      git.setError(`Failed to open diff: ${e}`);
    }
  }

  let expandedItems = $state(new Set<string>());

  function toggleExpand(id: string) {
    const next = new Set(expandedItems);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    expandedItems = next;
  }

  function statusIcon(type: 'added' | 'removed' | 'modified'): string {
    switch (type) {
      case 'added': return '+';
      case 'removed': return '−';
      case 'modified': return '~';
    }
  }

  function statusClass(type: 'added' | 'removed' | 'modified'): string {
    switch (type) {
      case 'added': return 'added';
      case 'removed': return 'removed';
      case 'modified': return 'modified';
    }
  }

  function formatValue(val: unknown): string {
    if (val === undefined || val === null) return '(none)';
    if (typeof val === 'string') return val || '""';
    return JSON.stringify(val);
  }

  const resources = $derived(git.changes?.resources ?? []);
  const connections = $derived(git.changes?.connections ?? []);
  const modules = $derived(git.changes?.modules ?? []);
  const instances = $derived(git.changes?.instances ?? []);
  const totalCount = $derived(resources.length + connections.length + modules.length + instances.length);
</script>

<CollapsibleSection id="git-changes" label={t('git.changes')} count={totalCount}>
  {#if totalCount === 0}
    <div class="empty">{t('git.noChanges')}</div>
  {:else}
    <div class="change-list">
      {#each resources as diff (diff.nodeId)}
        {@const expanded = expandedItems.has(diff.nodeId)}
        <button
          class="change-item {statusClass(diff.type)}"
          onclick={() => { toggleExpand(diff.nodeId); openWorkingDiff(); }}
        >
          <span class="status-icon">{statusIcon(diff.type)}</span>
          <span class="change-name">{diff.resourceName}</span>
          {#if diff.propertyChanges && diff.propertyChanges.length > 0}
            <span class="detail-count">{diff.propertyChanges.length}</span>
          {/if}
        </button>
        {#if expanded && diff.type === 'modified'}
          <div class="change-details">
            {#if diff.propertyChanges}
              {#each diff.propertyChanges as pc (pc.key)}
                <div class="detail-row">
                  <span class="detail-key">{pc.key}</span>
                  <span class="detail-value removed">{formatValue(pc.before)}</span>
                  <span class="detail-arrow">→</span>
                  <span class="detail-value added">{formatValue(pc.after)}</span>
                </div>
              {/each}
            {/if}
            {#if diff.variableChanges}
              {#each diff.variableChanges as vc (vc.key)}
                <div class="detail-row">
                  <span class="detail-key">{vc.key}</span>
                  <span class="detail-value">{vc.before ?? 'literal'} → {vc.after ?? 'literal'}</span>
                </div>
              {/each}
            {/if}
            {#if diff.outputChanges}
              {#each diff.outputChanges as oc (oc.key)}
                <div class="detail-row">
                  <span class="detail-key">output: {oc.key}</span>
                  <span class="detail-value {oc.enabled ? 'added' : 'removed'}">
                    {oc.enabled ? 'enabled' : 'disabled'}
                  </span>
                </div>
              {/each}
            {/if}
            {#if diff.parentChanged}
              <div class="detail-row">
                <span class="detail-key">parent</span>
                <span class="detail-value">{diff.parentChanged.before ?? '(none)'} → {diff.parentChanged.after ?? '(none)'}</span>
              </div>
            {/if}
          </div>
        {/if}
      {/each}

      {#each modules as diff (diff.moduleId)}
        <button class="change-item {statusClass(diff.type)}" onclick={openWorkingDiff}>
          <span class="status-icon">{statusIcon(diff.type)}</span>
          <span class="change-name">Module "{diff.moduleName}"</span>
        </button>
        {#if diff.type === 'modified'}
          <div class="change-details">
            {#if diff.renamed}
              <div class="detail-row">
                <span class="detail-key">name</span>
                <span class="detail-value removed">{diff.renamed.before}</span>
                <span class="detail-arrow">→</span>
                <span class="detail-value added">{diff.renamed.after}</span>
              </div>
            {/if}
            {#if diff.membersAdded}
              {#each diff.membersAdded as m}
                <div class="detail-row">
                  <span class="detail-key added">+ member</span>
                  <span class="detail-value">{m}</span>
                </div>
              {/each}
            {/if}
            {#if diff.membersRemoved}
              {#each diff.membersRemoved as m}
                <div class="detail-row">
                  <span class="detail-key removed">− member</span>
                  <span class="detail-value">{m}</span>
                </div>
              {/each}
            {/if}
          </div>
        {/if}
      {/each}

      {#each instances as diff (diff.instanceId)}
        <button class="change-item {statusClass(diff.type)}" onclick={openWorkingDiff}>
          <span class="status-icon">{statusIcon(diff.type)}</span>
          <span class="change-name">Instance "{diff.instanceName}"</span>
        </button>
      {/each}

      {#each connections as diff (diff.edgeId)}
        <button class="change-item {statusClass(diff.type)}" onclick={openWorkingDiff}>
          <span class="status-icon">{statusIcon(diff.type)}</span>
          <span class="change-name">{diff.sourceName} → {diff.targetName}</span>
        </button>
      {/each}
    </div>
  {/if}
</CollapsibleSection>

<style>
  .change-list {
    display: flex;
    flex-direction: column;
  }
  .empty {
    padding: 12px 16px;
    font-size: var(--font-11);
    color: var(--color-text-muted);
  }
  .change-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 16px;
    background: none;
    border: none;
    color: var(--color-text);
    font-size: var(--font-12);
    cursor: pointer;
    text-align: left;
    width: 100%;
  }
  .change-item:hover {
    background: var(--color-surface-hover);
  }
  .status-icon {
    width: 14px;
    font-weight: 700;
    font-size: 13px;
    flex-shrink: 0;
  }
  .change-item.added .status-icon { color: var(--color-success, #4ec96b); }
  .change-item.removed .status-icon { color: var(--color-error, #ff5050); }
  .change-item.modified .status-icon { color: var(--color-warning, #e8a838); }
  .change-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .detail-count {
    font-size: 10px;
    color: var(--color-text-muted);
    background: var(--color-surface-hover);
    border-radius: 8px;
    padding: 0 5px;
  }
  .change-details {
    padding: 2px 16px 4px 36px;
  }
  .detail-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 1px 0;
    font-size: var(--font-11);
    color: var(--color-text-muted);
  }
  .detail-key {
    color: var(--color-text-muted);
    min-width: 60px;
  }
  .detail-value {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
  }
  .detail-arrow {
    color: var(--color-text-muted);
    font-size: 10px;
  }
  .detail-key.added, .detail-value.added { color: var(--color-success, #4ec96b); }
  .detail-key.removed, .detail-value.removed { color: var(--color-error, #ff5050); }
</style>
