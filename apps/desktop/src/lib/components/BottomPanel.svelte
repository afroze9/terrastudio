<script lang="ts">
  import { ui, type BottomPanelTab } from '$lib/stores/ui.svelte';
  import { connectionWizard } from '$lib/stores/connection-wizard.svelte';
  import { validation } from '$lib/stores/validation.svelte';
  import { terraform } from '$lib/stores/terraform.svelte';
  import { git } from '$lib/stores/git.svelte';
  import { t } from '$lib/i18n';
  import TerminalTab from './bottom-panel/TerminalTab.svelte';
  import ProblemsTab from './bottom-panel/ProblemsTab.svelte';
  import ConnectionWizardTab from './bottom-panel/ConnectionWizardTab.svelte';
  import PlanTab from './bottom-panel/PlanTab.svelte';
  import GitOutputTab from './bottom-panel/GitOutputTab.svelte';

  let isResizing = $state(false);

  const tabs: { id: BottomPanelTab; labelKey: string }[] = [
    { id: 'terminal', labelKey: 'bottomPanel.terminal' },
    { id: 'problems', labelKey: 'bottomPanel.problems' },
    { id: 'connection-wizard', labelKey: 'bottomPanel.connection' },
    { id: 'plan', labelKey: 'bottomPanel.plan' },
    { id: 'git-output', labelKey: 'bottomPanel.gitOutput' },
  ];

  function onResizeMouseDown(e: MouseEvent) {
    e.preventDefault();
    isResizing = true;
    const startY = e.clientY;
    const startHeight = ui.bottomPanelHeight;

    function onMouseMove(e: MouseEvent) {
      const delta = startY - e.clientY;
      const newHeight = Math.max(100, Math.min(600, startHeight + delta));
      ui.setBottomPanelHeight(newHeight);
    }

    function onMouseUp() {
      isResizing = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }
</script>

{#if ui.showBottomPanel}
  <div class="bottom-panel" style="height: {ui.bottomPanelHeight}px">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="resize-handle"
      class:active={isResizing}
      onmousedown={onResizeMouseDown}
    ></div>
    <div class="panel-header">
      <div class="tab-bar">
        {#each tabs as tab (tab.id)}
          <button
            class="panel-tab"
            class:active={ui.activeBottomTab === tab.id}
            onclick={() => ui.openBottomPanel(tab.id)}
          >
            {t(tab.labelKey)}
            {#if tab.id === 'problems' && (validation.errorCount > 0 || validation.warningCount > 0)}
              <span class="problems-badge">
                {#if validation.errorCount > 0}
                  <span class="badge-error">{validation.errorCount}</span>
                {/if}
                {#if validation.warningCount > 0}
                  <span class="badge-warning">{validation.warningCount}</span>
                {/if}
              </span>
            {/if}
            {#if tab.id === 'connection-wizard' && connectionWizard.hasNewEntry && ui.activeBottomTab !== 'connection-wizard'}
              <span class="tab-badge"></span>
            {/if}
          </button>
        {/each}
      </div>
      {#if ui.activeBottomTab === 'terminal'}
        <button class="panel-icon-btn" onclick={() => terraform.clearOutput()} title="Clear output">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 3h12"/><path d="M5 3V2h6v1"/><path d="M6 7v5"/><path d="M10 7v5"/><path d="M3 3l1 10a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-10"/>
          </svg>
        </button>
      {/if}
      {#if ui.activeBottomTab === 'git-output'}
        <button class="panel-icon-btn" onclick={() => git.clearOutput()} title="Clear git output">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 3h12"/><path d="M5 3V2h6v1"/><path d="M6 7v5"/><path d="M10 7v5"/><path d="M3 3l1 10a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-10"/>
          </svg>
        </button>
      {/if}
      <button class="panel-icon-btn" onclick={() => { ui.showBottomPanel = false; }} title={t('bottomPanel.hide')}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="3" y1="8" x2="13" y2="8"/>
        </svg>
      </button>
    </div>
    <div class="panel-content">
      {#if ui.activeBottomTab === 'terminal'}
        <TerminalTab />
      {:else if ui.activeBottomTab === 'problems'}
        <ProblemsTab />
      {:else if ui.activeBottomTab === 'connection-wizard'}
        <ConnectionWizardTab />
      {:else if ui.activeBottomTab === 'plan'}
        <PlanTab />
      {:else if ui.activeBottomTab === 'git-output'}
        <GitOutputTab />
      {/if}
    </div>
  </div>
{/if}

<style>
  .bottom-panel {
    background: var(--color-bg);
    border-top: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex-shrink: 0;
    position: relative;
  }
  .resize-handle {
    position: absolute;
    top: -2px;
    left: 0;
    right: 0;
    height: 4px;
    cursor: row-resize;
    z-index: 10;
  }
  .resize-handle:hover, .resize-handle.active {
    background: var(--color-accent);
    opacity: 0.5;
  }
  .panel-header {
    display: flex;
    align-items: center;
    padding: 0 12px 0 0;
    height: 30px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--color-border);
    gap: 0;
  }
  .tab-bar {
    display: flex;
    align-items: stretch;
    height: 100%;
    flex: 1;
    gap: 0;
  }
  .panel-tab {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--color-text-muted);
    font-size: var(--font-11);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    cursor: pointer;
    padding: 0 12px;
    height: 100%;
    display: flex;
    align-items: center;
    transition: color 0.1s;
  }
  .panel-tab:hover {
    color: var(--color-text);
  }
  .panel-tab.active {
    color: var(--color-text);
    border-bottom-color: var(--color-accent);
  }
  .panel-icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: none;
    border: none;
    border-radius: 4px;
    color: var(--color-text-muted);
    cursor: pointer;
    opacity: 0.6;
    transition: opacity 0.1s, background 0.1s;
  }
  .panel-icon-btn:hover {
    color: var(--color-text);
    opacity: 1;
    background: var(--color-surface-hover);
  }
  .tab-badge {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-accent);
    display: inline-block;
    margin-left: 4px;
    flex-shrink: 0;
  }
  .problems-badge {
    display: inline-flex;
    gap: 3px;
    margin-left: 4px;
  }
  .badge-error {
    font-size: var(--font-9);
    padding: 0 4px;
    border-radius: 8px;
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
    font-weight: 600;
    line-height: 14px;
  }
  .badge-warning {
    font-size: var(--font-9);
    padding: 0 4px;
    border-radius: 8px;
    background: rgba(245, 158, 11, 0.2);
    color: #f59e0b;
    font-weight: 600;
    line-height: 14px;
  }
  .panel-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    min-height: 0;
  }
</style>
