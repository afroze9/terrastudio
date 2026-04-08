<script lang="ts">
  import { git } from '$lib/stores/git.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import { project } from '$lib/stores/project.svelte';
  import { t } from '$lib/i18n';
  import CollapsibleSection from '../CollapsibleSection.svelte';
  import { getSnapshotAtRef } from '$lib/services/git-service';
  import { computeDiagramDiff } from '$lib/services/diff-engine';

  async function openHistoryDiff(hash: string, shortHash: string, message: string) {
    if (!project.path) return;
    try {
      const after = await getSnapshotAtRef(project.path, hash);
      let before;
      try {
        before = await getSnapshotAtRef(project.path, `${hash}~1`);
      } catch {
        // First commit — no parent, use empty snapshot
        before = { nodes: [], edges: [], modules: [], moduleInstances: [] };
      }
      const diff = computeDiagramDiff(before, after);
      git.enterDiffMode(`${shortHash} — ${message}`, before, after, diff);
      ui.openDiffTab(`${shortHash} vs parent`);
    } catch (e) {
      git.setError(`Failed to open diff: ${e}`);
    }
  }

  function formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return 'today';
      if (diffDays === 1) return 'yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
      return date.toLocaleDateString();
    } catch {
      return dateStr;
    }
  }
</script>

<CollapsibleSection id="git-history" label={t('git.history')} count={git.history.length}>
  {#if git.history.length === 0}
    <div class="empty">{t('git.noHistory')}</div>
  {:else}
    <div class="history-list">
      {#each git.history as entry (entry.hash)}
        <button class="history-item" onclick={() => openHistoryDiff(entry.hash, entry.short_hash, entry.message)}>
          <span class="commit-hash">{entry.short_hash}</span>
          <span class="commit-message">{entry.message}</span>
          <span class="commit-date">{formatDate(entry.date)}</span>
        </button>
      {/each}
    </div>
  {/if}
</CollapsibleSection>

<style>
  .history-list {
    display: flex;
    flex-direction: column;
  }
  .empty {
    padding: 12px 16px;
    font-size: var(--font-11);
    color: var(--color-text-muted);
  }
  .history-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 16px;
    background: none;
    border: none;
    color: var(--color-text);
    font-size: var(--font-12);
    cursor: pointer;
    text-align: left;
    width: 100%;
  }
  .history-item:hover {
    background: var(--color-surface-hover);
  }
  .commit-hash {
    font-family: var(--font-mono, monospace);
    font-size: var(--font-11);
    color: var(--color-accent);
    flex-shrink: 0;
    width: 52px;
  }
  .commit-message {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .commit-date {
    font-size: 10px;
    color: var(--color-text-muted);
    flex-shrink: 0;
  }
</style>
