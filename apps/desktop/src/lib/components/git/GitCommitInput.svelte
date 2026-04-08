<script lang="ts">
  import { git } from '$lib/stores/git.svelte';
  import { project } from '$lib/stores/project.svelte';
  import { t } from '$lib/i18n';
  import { commitWithHclGeneration } from '$lib/services/git-service';

  let message = $state('');

  const canCommit = $derived(message.trim().length > 0 && git.hasChanges && !git.loading);

  async function handleCommit() {
    if (!canCommit || !project.path) return;
    const msg = message.trim();
    message = '';
    await commitWithHclGeneration(project.path, msg);
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleCommit();
    }
  }
</script>

<div class="commit-area">
  <textarea
    class="commit-input"
    placeholder={t('git.commitPlaceholder')}
    bind:value={message}
    onkeydown={onKeydown}
    rows="3"
    disabled={git.loading}
  ></textarea>
  <button
    class="commit-btn"
    onclick={handleCommit}
    disabled={!canCommit}
    title={t('git.commitTooltip')}
  >
    {#if git.loading}
      {t('git.committing')}
    {:else}
      {t('git.commit')}
    {/if}
  </button>
</div>

<style>
  .commit-area {
    padding: 8px 12px;
    border-bottom: 1px solid var(--color-border);
  }
  .commit-input {
    width: 100%;
    padding: 6px 8px;
    font-size: var(--font-12);
    font-family: inherit;
    background: var(--color-bg);
    color: var(--color-text);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    resize: vertical;
    min-height: 36px;
    outline: none;
    box-sizing: border-box;
  }
  .commit-input:focus {
    border-color: var(--color-accent);
  }
  .commit-input:disabled {
    opacity: 0.5;
  }
  .commit-btn {
    width: 100%;
    padding: 5px 12px;
    margin-top: 6px;
    font-size: var(--font-12);
    font-weight: 500;
    background: var(--color-accent);
    color: var(--color-bg);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    box-sizing: border-box;
  }
  .commit-btn:hover:not(:disabled) {
    opacity: 0.9;
  }
  .commit-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
