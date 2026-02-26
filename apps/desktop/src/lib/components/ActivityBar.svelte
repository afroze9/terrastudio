<script lang="ts">
  import { ui, type SidebarView } from '$lib/stores/ui.svelte';

  const views: { id: SidebarView; label: string; icon: string }[] = [
    {
      id: 'explorer',
      label: 'Resources',
      icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
    },
    {
      id: 'terraform',
      label: 'Terraform',
      icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
    },
    {
      id: 'settings',
      label: 'Project',
      icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>`,
    },
    {
      id: 'cost',
      label: 'Cost Estimates',
      icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    },
  ];
</script>

<nav class="activity-bar">
  <div class="views-top">
    {#each views as view (view.id)}
      <button
        class="activity-btn"
        class:active={ui.activeView === view.id && ui.showSidePanel}
        onclick={() => ui.setActiveView(view.id)}
        title={view.label}
        aria-label={view.label}
      >
        {@html view.icon}
      </button>
    {/each}
  </div>
  <div class="views-bottom">
    <button
      class="activity-btn"
      class:active={ui.activeView === 'app-settings' && ui.showSidePanel}
      onclick={() => ui.setActiveView('app-settings')}
      title="Settings"
      aria-label="Settings"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1.08 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
      </svg>
    </button>
  </div>
</nav>

<style>
  .activity-bar {
    width: 48px;
    min-width: 48px;
    background: var(--color-bg);
    border-right: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    padding-top: 4px;
    padding-bottom: 4px;
    flex-shrink: 0;
  }
  .views-top {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .views-bottom {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .activity-btn {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    border-left: 2px solid transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: color 0.15s;
    opacity: 0.6;
  }
  .activity-btn:hover {
    color: var(--color-text);
    opacity: 1;
  }
  .activity-btn.active {
    color: var(--color-text);
    border-left-color: var(--color-accent);
    opacity: 1;
  }
</style>
