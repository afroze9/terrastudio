<script lang="ts">
  import { ui, type RightPanelView } from '$lib/stores/ui.svelte';

  const views: { id: RightPanelView; label: string; icon: string }[] = [
    {
      id: 'properties',
      label: 'Properties',
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>`,
    },
    {
      id: 'formatting',
      label: 'Visual Style',
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2v-1c0-.6.2-1.1.6-1.5.4-.4.4-1 0-1.5-.4-.4-.6-.9-.6-1.5V14c0-1.1.9-2 2-2h1.5c1.1 0 2-.9 2-2a10 10 0 0 0-7.5-8z"/><circle cx="7.5" cy="10.5" r="1.5" fill="currentColor"/><circle cx="12" cy="7.5" r="1.5" fill="currentColor"/><circle cx="16.5" cy="10.5" r="1.5" fill="currentColor"/></svg>`,
    },
  ];
</script>

<nav class="right-activity-bar">
  {#each views as view (view.id)}
    <button
      class="activity-btn"
      class:active={ui.activeRightView === view.id && ui.showPropertiesPanel}
      onclick={() => ui.setActiveRightView(view.id)}
      title={view.label}
      aria-label={view.label}
    >
      {@html view.icon}
    </button>
  {/each}
</nav>

<style>
  .right-activity-bar {
    width: 36px;
    min-width: 36px;
    background: var(--color-bg);
    border-left: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 4px;
    flex-shrink: 0;
  }
  .activity-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    border-right: 2px solid transparent;
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
    border-right-color: var(--color-accent);
    opacity: 1;
  }
</style>
