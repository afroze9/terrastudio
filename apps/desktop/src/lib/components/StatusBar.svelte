<script lang="ts">
  import { terraform } from '$lib/stores/terraform.svelte';
  import { ui, type BottomPanelTab } from '$lib/stores/ui.svelte';
  import { connectionWizard } from '$lib/stores/connection-wizard.svelte';
  import { validation } from '$lib/stores/validation.svelte';
  import { git } from '$lib/stores/git.svelte';
  import PaletteSelector from './PaletteSelector.svelte';
  import { t } from '$lib/i18n';

  let showPaletteSelector = $state(false);
  let currentAccent = $derived(ui.palette?.previewAccent ?? '#818cf8');

  const panelButtons: { id: BottomPanelTab; labelKey: string; icon: string }[] = [
    {
      id: 'terminal',
      labelKey: 'status.terminal',
      icon: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6L7 8.5L4 11" /><path d="M8.5 11H12" /></svg>',
    },
    {
      id: 'problems',
      labelKey: 'status.problems',
      icon: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.5L14.5 13H1.5L8 1.5z" /><path d="M8 6.5v3" /><circle cx="8" cy="11.5" r="0.5" fill="currentColor" /></svg>',
    },
    {
      id: 'connection-wizard',
      labelKey: 'status.connection',
      icon: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3v6a2 2 0 0 1-2 2H5" /><polyline points="8 8 5 11 8 14" /></svg>',
    },
    {
      id: 'plan',
      labelKey: 'status.plan',
      icon: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2h8v12H4z"/><path d="M6 5h4"/><path d="M6 8h4"/><path d="M6 11h2"/></svg>',
    },
  ];

  const statusLabel = $derived.by(() => {
    switch (terraform.status) {
      case 'idle':
        return t('status.ready');
      case 'generating':
        return t('status.generatingHcl');
      case 'writing':
        return t('status.writingFiles');
      case 'running':
        return t('status.running', { command: terraform.currentCommand ?? '' });
      case 'success':
        return t('status.success');
      case 'error':
        return t('status.error');
      default:
        return t('status.ready');
    }
  });

  const statusColor = $derived.by(() => {
    switch (terraform.status) {
      case 'running':
      case 'generating':
      case 'writing':
        return '#3b82f6';
      case 'success':
        return '#22c55e';
      case 'error':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<svelte:window onclick={() => { showPaletteSelector = false; }} />

<footer class="status-bar">
  <div class="status-left">
    {#each panelButtons as btn (btn.id)}
      <button
        class="panel-toggle"
        class:active={ui.showBottomPanel && ui.activeBottomTab === btn.id}
        title={t(btn.labelKey)}
        onclick={() => ui.toggleBottomPanel(btn.id)}
      >
        {@html btn.icon}
        {#if btn.id === 'problems'}
          <span class="panel-toggle-label problems-counts">
            {#if validation.errorCount > 0}
              <span class="status-count-error">{validation.errorCount}</span>
            {/if}
            {#if validation.warningCount > 0}
              <span class="status-count-warning">{validation.warningCount}</span>
            {/if}
            {#if validation.errorCount === 0 && validation.warningCount === 0}
              <span>{t(btn.labelKey)}</span>
            {/if}
          </span>
        {:else}
          <span class="panel-toggle-label">{t(btn.labelKey)}</span>
        {/if}
        {#if btn.id === 'connection-wizard' && connectionWizard.hasNewEntry && ui.activeBottomTab !== 'connection-wizard'}
          <span class="status-badge"></span>
        {/if}
      </button>
    {/each}
  </div>
  <div class="status-right">
    {#if git.isRepo}
      <button
        class="panel-toggle"
        class:active={ui.showBottomPanel && ui.activeBottomTab === 'git-output'}
        title={t('status.gitOutput')}
        onclick={() => ui.toggleBottomPanel('git-output')}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><circle cx="4" cy="4" r="2"/><path d="M9 4h2a1.5 1.5 0 0 1 1.5 1.5V10"/><line x1="4" y1="6" x2="4" y2="14"/></svg>
        <span class="panel-toggle-label">{git.branch || 'HEAD'}</span>
      </button>
      <span class="separator"></span>
    {/if}
    <span
      class="status-dot"
      class:pulse={terraform.isRunning}
      style="background: {statusColor}"
    ></span>
    <span class="status-label">{statusLabel}</span>
    <span class="separator"></span>
    <div class="palette-btn-wrapper">
      <button
        class="status-btn icon-btn"
        title={t('status.colorPalette')}
        onclick={(e: MouseEvent) => { e.stopPropagation(); showPaletteSelector = !showPaletteSelector; }}
      >
        <span class="palette-dot" style="background: {currentAccent}"></span>
      </button>
      {#if showPaletteSelector}
        <div class="palette-popup">
          <PaletteSelector onclose={() => { showPaletteSelector = false; }} />
        </div>
      {/if}
    </div>
    <button
      class="status-btn icon-btn"
      title={ui.theme === 'dark' ? t('status.switchToLight') : t('status.switchToDark')}
      onclick={() => ui.toggleTheme()}
    >
      {#if ui.theme === 'dark'}
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="8" cy="8" r="3.5" />
          <path d="M8 1.5V3" />
          <path d="M8 13V14.5" />
          <path d="M3.4 3.4L4.45 4.45" />
          <path d="M11.55 11.55L12.6 12.6" />
          <path d="M1.5 8H3" />
          <path d="M13 8H14.5" />
          <path d="M3.4 12.6L4.45 11.55" />
          <path d="M11.55 4.45L12.6 3.4" />
        </svg>
      {:else}
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M13.5 8.5C13.5 11.81 10.81 14.5 7.5 14.5C4.19 14.5 1.5 11.81 1.5 8.5C1.5 5.19 4.19 2.5 7.5 2.5C7.5 2.5 6.5 5 8 7C9.5 9 12 8.5 12 8.5C12 8.5 13.5 8.17 13.5 8.5Z" />
        </svg>
      {/if}
    </button>
  </div>
</footer>

<style>
  .status-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 28px;
    padding: 0 8px;
    background: var(--color-surface);
    border-top: 1px solid var(--color-border);
    flex-shrink: 0;
    font-size: var(--font-11);
    color: var(--color-text-muted);
  }
  .status-left, .status-right {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .status-right {
    gap: 6px;
  }
  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .status-dot.pulse {
    animation: pulse 1.5s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  .status-label {
    font-size: var(--font-11);
  }
  .separator {
    width: 1px;
    height: 12px;
    background: var(--color-border);
    opacity: 0.5;
  }
  .panel-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: var(--font-11);
    cursor: pointer;
    padding: 2px 8px;
    height: 24px;
    border-radius: 3px;
    position: relative;
  }
  .panel-toggle:hover {
    color: var(--color-text);
    background: var(--color-surface-hover);
  }
  .panel-toggle.active {
    color: var(--color-text);
    background: var(--color-surface-hover);
  }
  .panel-toggle-label {
    font-size: var(--font-11);
  }
  .problems-counts {
    display: flex;
    align-items: center;
    gap: 3px;
  }
  .status-count-error {
    color: #ef4444;
    font-size: var(--font-11);
    font-weight: 600;
  }
  .status-count-warning {
    color: #f59e0b;
    font-size: var(--font-11);
    font-weight: 600;
  }
  .status-badge {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-accent);
    flex-shrink: 0;
  }
  .status-btn {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: var(--font-11);
    cursor: pointer;
    padding: 0 6px;
    height: 28px;
    line-height: 28px;
  }
  .status-btn.icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
  }
  .status-btn:hover {
    color: var(--color-text);
    background: var(--color-surface-hover);
  }
  .palette-btn-wrapper {
    position: relative;
  }
  .palette-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
  }
  .palette-popup {
    position: absolute;
    bottom: calc(100% + 6px);
    right: 0;
    z-index: 100;
  }
</style>
