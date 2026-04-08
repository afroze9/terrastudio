<script lang="ts">
  import { onMount } from 'svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import { project } from '$lib/stores/project.svelte';
  import { git } from '$lib/stores/git.svelte';
  import { t } from '$lib/i18n';
  import { refreshGitState, initializeRepo } from '$lib/services/git-service';
  import GitCommitInput from './GitCommitInput.svelte';
  import GitChangeList from './GitChangeList.svelte';
  import TerraformChangeList from './TerraformChangeList.svelte';
  import GitHistoryList from './GitHistoryList.svelte';
  import GitBranchSelector from './GitBranchSelector.svelte';

  // Refresh git state when the panel becomes visible
  $effect(() => {
    if (ui.activeView === 'git' && project.path) {
      refreshGitState(project.path);
    }
  });

  // Also refresh on window focus
  onMount(() => {
    const onFocus = () => {
      if (ui.activeView === 'git' && project.path) {
        refreshGitState(project.path);
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  });

  async function handleInit() {
    if (!project.path) return;
    await initializeRepo(project.path);
  }
</script>

<div class="git-panel">
  {#if !project.path}
    <div class="empty-state">
      <p class="empty-text">{t('git.noProject')}</p>
    </div>
  {:else if !git.isRepo}
    <div class="empty-state">
      <p class="empty-text">{t('git.notARepo')}</p>
      <button class="init-btn" onclick={handleInit} disabled={git.loading}>
        {t('git.initialize')}
      </button>
    </div>
  {:else}
    <GitBranchSelector />
    <GitCommitInput />

    {#if git.error}
      <div class="error-bar">
        <span class="error-text">{git.error}</span>
        <button class="dismiss-btn" onclick={() => git.setError(null)}>×</button>
      </div>
    {/if}

    <div class="sections">
      <GitChangeList />
      <TerraformChangeList />
      <GitHistoryList />
    </div>
  {/if}
</div>

<style>
  .git-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 24px 16px;
    flex: 1;
  }
  .empty-text {
    font-size: var(--font-12);
    color: var(--color-text-muted);
    text-align: center;
    margin: 0;
  }
  .init-btn {
    padding: 6px 16px;
    font-size: var(--font-12);
    background: var(--color-accent);
    color: var(--color-bg);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
  }
  .init-btn:hover {
    opacity: 0.9;
  }
  .init-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .error-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: var(--color-error-bg, rgba(255, 80, 80, 0.1));
    border-bottom: 1px solid var(--color-border);
  }
  .error-text {
    flex: 1;
    font-size: var(--font-11);
    color: var(--color-error, #ff5050);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dismiss-btn {
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: 14px;
    padding: 0 2px;
  }
  .sections {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }
</style>
