<script lang="ts">
  import { ui } from '$lib/stores/ui.svelte';
  import { t } from '$lib/i18n';
  import { registry } from '$lib/bootstrap';
  import type { PaletteCategory } from '@terrastudio/types';
  import ResourcePalette from './ResourcePalette.svelte';
  import TerraformSidebar from './TerraformSidebar.svelte';
  import ProjectConfigPanel from './ProjectConfigPanel.svelte';
  import AppSettingsPanel from './AppSettingsPanel.svelte';
  import CostPanel from './CostPanel.svelte';
  import SearchPanel from './SearchPanel.svelte';
  import GitPanel from './git/GitPanel.svelte';
  import { git } from '$lib/stores/git.svelte';
  import { project } from '$lib/stores/project.svelte';
  import { refreshGitState, pushAndRefresh, pullAndRefresh } from '$lib/services/git-service';

  const categoryIds = registry.paletteCategories.map((c: PaletteCategory) => c.id);

  const SECTION_IDS: Record<string, string[]> = {
    explorer: categoryIds,
    terraform: ['tf-files', 'tf-variables', 'tf-commands'],
    settings: ['project-provider', 'project-naming', 'project-layout', 'project-edge-styles', 'project-tags'],
    'app-settings': ['app-appearance', 'app-canvas', 'app-cost', 'app-logging'],
    cost: ['cost-summary', 'cost-by-type', 'cost-notes'],
  };

  const activeCategoryIds = $derived(SECTION_IDS[ui.activeView] ?? []);
  const allCollapsed = $derived(activeCategoryIds.every((id) => ui.isCategoryCollapsed(id)));

  const viewTitle = $derived.by(() => {
    switch (ui.activeView) {
      case 'explorer': return t('sidebar.resources');
      case 'terraform': return t('sidebar.terraform');
      case 'settings': return t('sidebar.project');
      case 'app-settings': return t('sidebar.settings');
      case 'cost': return t('sidebar.cost');
      case 'search': return t('sidebar.search');
      case 'git': return t('sidebar.git');
      default: return '';
    }
  });

  let isResizing = $state(false);

  function onMouseDown(e: MouseEvent) {
    e.preventDefault();
    isResizing = true;
    const startX = e.clientX;
    const startWidth = ui.sidePanelWidth;

    function onMouseMove(e: MouseEvent) {
      const delta = e.clientX - startX;
      const newWidth = Math.max(200, Math.min(500, startWidth + delta));
      ui.sidePanelWidth = newWidth;
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

<aside class="side-panel" style="width: {ui.sidePanelWidth}px">
  <div class="panel-header">
    <span class="panel-title">{viewTitle}</span>
    <div class="header-spacer"></div>
    {#if ui.activeView === 'git' && git.isRepo}
      <button
        class="header-action"
        onclick={() => { if (project.path) refreshGitState(project.path); }}
        title="Fetch"
        disabled={git.loading}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 2v8"/><polyline points="4 6 8 2 12 6"/>
          <path d="M3 12h10"/>
        </svg>
      </button>
      <button
        class="header-action"
        onclick={() => { if (project.path) pullAndRefresh(project.path); }}
        title="Pull"
        disabled={git.loading}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 2v8"/><polyline points="4 6 8 10 12 6"/>
        </svg>
      </button>
      <button
        class="header-action"
        onclick={() => { if (project.path) pushAndRefresh(project.path); }}
        title="Push"
        disabled={git.loading}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 14V6"/><polyline points="4 10 8 6 12 10"/>
        </svg>
      </button>
    {/if}
    {#if activeCategoryIds.length > 0}
      <button
        class="header-action"
        onclick={() => ui.toggleAllCategories(activeCategoryIds)}
        title={allCollapsed ? t('sidebar.expandAll') : t('sidebar.collapseAll')}
        aria-label={allCollapsed ? t('sidebar.expandAllCategories') : t('sidebar.collapseAllCategories')}
      >
        {#if allCollapsed}
          <!-- ^ v  — chevrons pointing apart (expand) -->
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="4 6 8 2 12 6"/>
            <polyline points="4 10 8 14 12 10"/>
          </svg>
        {:else}
          <!-- v ^  — chevrons pointing together (collapse) -->
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="4 2 8 6 12 2"/>
            <polyline points="4 14 8 10 12 14"/>
          </svg>
        {/if}
      </button>
    {/if}
  </div>
  <div class="panel-content">
    {#if ui.activeView === 'explorer'}
      <ResourcePalette />
    {:else if ui.activeView === 'terraform'}
      <TerraformSidebar />
    {:else if ui.activeView === 'settings'}
      <ProjectConfigPanel />
    {:else if ui.activeView === 'app-settings'}
      <AppSettingsPanel />
    {:else if ui.activeView === 'cost'}
      <CostPanel />
    {:else if ui.activeView === 'search'}
      <SearchPanel />
    {:else if ui.activeView === 'git'}
      <GitPanel />
    {/if}
  </div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="resize-handle"
    class:active={isResizing}
    onmousedown={onMouseDown}
  ></div>
</aside>

<style>
  .side-panel {
    min-width: 200px;
    max-width: 500px;
    background: var(--color-surface);
    border-right: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    position: relative;
    overflow: hidden;
  }
  .panel-header {
    display: flex;
    align-items: center;
    padding: 0 12px;
    height: 35px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--color-border);
  }
  .panel-title {
    font-size: var(--font-11);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
  }
  .header-spacer {
    flex: 1;
  }
  .header-action {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    opacity: 0.5;
    transition: opacity 0.1s, background 0.1s;
  }
  .header-action:hover {
    opacity: 1;
    background: var(--color-surface-hover);
  }
  .panel-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }
  .resize-handle {
    position: absolute;
    top: 0;
    right: -2px;
    width: 4px;
    height: 100%;
    cursor: col-resize;
    z-index: 10;
  }
  .resize-handle:hover, .resize-handle.active {
    background: var(--color-accent);
    opacity: 0.5;
  }
</style>
