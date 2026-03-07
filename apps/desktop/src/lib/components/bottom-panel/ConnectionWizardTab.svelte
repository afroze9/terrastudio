<script lang="ts">
  import { connectionWizard } from '$lib/stores/connection-wizard.svelte';
  import ConnectionWizardCard from '../ConnectionWizardCard.svelte';
  import ConnectionWizardHistoryItem from '../ConnectionWizardHistoryItem.svelte';
  import { t } from '$lib/i18n';

  // Clear badge when this tab is visible
  $effect(() => {
    connectionWizard.hasNewEntry = false;
  });
</script>

<div class="wizard-tab">
  <!-- Active connection card -->
  {#if connectionWizard.activeEntry}
    <div class="active-section">
      <div class="active-header">
        <span class="active-label">{t('bottomPanel.latestConnection')}</span>
        <button class="dismiss-btn" onclick={() => connectionWizard.clearActive()}>{t('bottomPanel.dismiss')}</button>
      </div>
      <ConnectionWizardCard entry={connectionWizard.activeEntry} />
    </div>
  {:else if connectionWizard.history.length === 0}
    <div class="placeholder">
      <div class="placeholder-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </div>
      <span class="placeholder-text">{t('bottomPanel.connectionPlaceholder')}</span>
    </div>
  {/if}

  <!-- History section -->
  {#if connectionWizard.history.length > 0}
    <div class="history-section">
      <div class="history-header">
        <span class="history-label">{t('bottomPanel.connectionHistory')}</span>
        <button class="clear-btn" onclick={() => connectionWizard.clearHistory()}>{t('bottomPanel.clear')}</button>
      </div>
      <div class="history-list">
        {#each connectionWizard.history as entry (entry.id)}
          <ConnectionWizardHistoryItem {entry} />
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .wizard-tab {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
    padding: 0;
  }

  .active-section {
    padding: 10px 12px;
    border-bottom: 1px solid var(--color-border);
  }

  .active-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .active-label {
    font-size: var(--font-10);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-accent);
  }

  .dismiss-btn {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: var(--font-10);
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 3px;
  }

  .dismiss-btn:hover {
    color: var(--color-text);
    background: var(--color-surface-hover);
  }

  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 8px;
    padding: 24px;
    color: var(--color-text-muted);
    opacity: 0.5;
  }

  .placeholder-icon {
    opacity: 0.4;
  }

  .placeholder-text {
    font-size: var(--font-12);
    text-align: center;
  }

  .history-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .history-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    border-bottom: 1px solid var(--color-border);
  }

  .history-label {
    font-size: var(--font-10);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
  }

  .clear-btn {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: var(--font-10);
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 3px;
  }

  .clear-btn:hover {
    color: var(--color-text);
    background: var(--color-surface-hover);
  }

  .history-list {
    flex: 1;
    overflow-y: auto;
  }
</style>
