<script lang="ts">
  import { diagram } from '$lib/stores/diagram.svelte';
  import { ui, type EdgeStyle } from '$lib/stores/ui.svelte';
  import { project } from '$lib/stores/project.svelte';
  import { registry } from '$lib/bootstrap';
  import { saveDiagram } from '$lib/services/project-service';
  import { autoLayout, type LayoutDirection } from '$lib/services/layout-service';
  import { t } from '$lib/i18n';
  import type { EdgeCategoryId } from '@terrastudio/types';

  let showLayoutMenu = $state(false);
  let showEdgeMenu = $state(false);
  let showGridMenu = $state(false);
  let showEdgeVisibilityMenu = $state(false);

  const edgeCategoryOptions: { id: EdgeCategoryId; labelKey: string; descKey: string }[] = [
    { id: 'structural', labelKey: 'canvas.edgeCategories.structural', descKey: 'canvas.edgeCategories.structuralDesc' },
    { id: 'binding', labelKey: 'canvas.edgeCategories.binding', descKey: 'canvas.edgeCategories.bindingDesc' },
    { id: 'reference', labelKey: 'canvas.edgeCategories.reference', descKey: 'canvas.edgeCategories.referenceDesc' },
    { id: 'annotation', labelKey: 'canvas.edgeCategories.annotation', descKey: 'canvas.edgeCategories.annotationDesc' },
  ];

  const gridSizes = [10, 15, 20, 25, 30, 40, 50];

  const layoutOptions: { value: LayoutDirection; labelKey: string; icon: string }[] = [
    { value: 'TB', labelKey: 'canvas.toolbar.topToBottom', icon: '↓' },
    { value: 'LR', labelKey: 'canvas.toolbar.leftToRight', icon: '→' },
    { value: 'BT', labelKey: 'canvas.toolbar.bottomToTop', icon: '↑' },
    { value: 'RL', labelKey: 'canvas.toolbar.rightToLeft', icon: '←' },
  ];

  const edgeOptions: { value: EdgeStyle; labelKey: string }[] = [
    { value: 'default', labelKey: 'edgeStyle.bezier' },
    { value: 'smoothstep', labelKey: 'edgeStyle.smoothStep' },
    { value: 'step', labelKey: 'edgeStyle.step' },
    { value: 'straight', labelKey: 'edgeStyle.straight' },
  ];

  function handleLayout(direction: LayoutDirection) {
    showLayoutMenu = false;
    autoLayout(registry, direction);
    ui.fitView?.();
  }

  function handleEdgeStyle(style: EdgeStyle) {
    showEdgeMenu = false;
    ui.setEdgeType(style);
  }

  async function handleSave() {
    if (project.isOpen) await saveDiagram();
  }

  function handleFitView() {
    ui.fitView?.();
  }

  function closeMenus(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.toolbar-dropdown-wrapper')) {
      showLayoutMenu = false;
      showEdgeMenu = false;
      showGridMenu = false;
      showEdgeVisibilityMenu = false;
    }
  }

  // Count how many edge categories are hidden
  let hiddenEdgeCount = $derived(
    edgeCategoryOptions.filter((cat) => !ui.edgeVisibility[cat.id]).length
  );


</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<svelte:window onclick={closeMenus} />

<div class="canvas-toolbar">
  <!-- Save -->
  <button
    class="toolbar-btn"
    title={t('canvas.toolbar.save')}
    aria-label={t('canvas.toolbar.save')}
    disabled={!project.isOpen}
    onclick={handleSave}
  >
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12.5 14H3.5C2.95 14 2.5 13.55 2.5 13V3C2.5 2.45 2.95 2 3.5 2H10.5L13.5 5V13C13.5 13.55 13.05 14 12.5 14Z" />
      <path d="M11.5 14V9H4.5V14" />
      <path d="M4.5 2V5.5H9.5" />
    </svg>
  </button>

  <div class="toolbar-separator"></div>

  <!-- Undo -->
  <button
    class="toolbar-btn"
    title={t('canvas.toolbar.undo')}
    aria-label={t('canvas.toolbar.undo')}
    disabled={!diagram.canUndo}
    onclick={() => diagram.undo()}
  >
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 7H10C11.66 7 13 8.34 13 10C13 11.66 11.66 13 10 13H8" />
      <path d="M6 4L3 7L6 10" />
    </svg>
  </button>

  <!-- Redo -->
  <button
    class="toolbar-btn"
    title={t('canvas.toolbar.redo')}
    aria-label={t('canvas.toolbar.redo')}
    disabled={!diagram.canRedo}
    onclick={() => diagram.redo()}
  >
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M13 7H6C4.34 7 3 8.34 3 10C3 11.66 4.34 13 6 13H8" />
      <path d="M10 4L13 7L10 10" />
    </svg>
  </button>

  <div class="toolbar-separator"></div>

  <!-- Auto Layout -->
  <div class="toolbar-dropdown-wrapper">
    <button
      class="toolbar-btn"
      class:active={showLayoutMenu}
      title={t('canvas.toolbar.autoLayout')}
      aria-label={t('canvas.toolbar.autoLayout')}
      aria-haspopup="true"
      aria-expanded={showLayoutMenu}
      disabled={diagram.nodes.length === 0}
      onclick={(e) => { e.stopPropagation(); showEdgeMenu = false; showLayoutMenu = !showLayoutMenu; }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="5.5" y="1" width="5" height="3.5" rx="0.5" />
        <rect x="1" y="11.5" width="5" height="3.5" rx="0.5" />
        <rect x="10" y="11.5" width="5" height="3.5" rx="0.5" />
        <path d="M8 4.5V8" />
        <path d="M8 8H3.5V11.5" />
        <path d="M8 8H12.5V11.5" />
      </svg>
    </button>
    {#if showLayoutMenu}
      <div class="toolbar-dropdown">
        {#each layoutOptions as opt (opt.value)}
          <button class="toolbar-dropdown-item" onclick={() => handleLayout(opt.value)}>
            <span class="layout-icon">{opt.icon}</span>
            <span>{t(opt.labelKey)}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Fit View -->
  <button
    class="toolbar-btn"
    title={t('canvas.toolbar.fitView')}
    aria-label={t('canvas.toolbar.fitView')}
    onclick={handleFitView}
  >
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2 6V2.5H5.5" />
      <path d="M14 6V2.5H10.5" />
      <path d="M2 10V13.5H5.5" />
      <path d="M14 10V13.5H10.5" />
      <rect x="5" y="5" width="6" height="6" rx="0.5" />
    </svg>
  </button>

  <div class="toolbar-separator"></div>

  <!-- Edge Style -->
  <div class="toolbar-dropdown-wrapper">
    <button
      class="toolbar-btn"
      class:active={showEdgeMenu}
      title={t('canvas.toolbar.edgeStyle')}
      aria-label={t('canvas.toolbar.edgeStyle')}
      aria-haspopup="true"
      aria-expanded={showEdgeMenu}
      onclick={(e) => { e.stopPropagation(); showLayoutMenu = false; showEdgeMenu = !showEdgeMenu; }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="3" cy="13" r="1.5" />
        <circle cx="13" cy="3" r="1.5" />
        <path d="M4 11.5C4 8 6 6 8 6C10 6 12 4.5 12 4.5" />
      </svg>
    </button>
    {#if showEdgeMenu}
      <div class="toolbar-dropdown">
        {#each edgeOptions as opt (opt.value)}
          <button
            class="toolbar-dropdown-item"
            class:selected={ui.edgeType === opt.value}
            onclick={() => handleEdgeStyle(opt.value)}
          >
            <span>{t(opt.labelKey)}</span>
            {#if ui.edgeType === opt.value}
              <span class="check">&#10003;</span>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <div class="toolbar-separator"></div>

  <!-- Snap to Grid Toggle -->
  <button
    class="toolbar-btn"
    class:snap-active={ui.snapToGrid}
    title={ui.snapToGrid ? `${t('canvas.toolbar.snapToGrid')} (${ui.gridSize}${t('canvas.toolbar.px')}) — ${t('canvas.toolbar.clickToDisable')}` : `${t('canvas.toolbar.snapToGrid')} — ${t('canvas.toolbar.clickToEnable')}`}
    aria-label={t('canvas.toolbar.snapToGrid')}
    aria-pressed={ui.snapToGrid}
    onclick={() => { ui.setSnapToGrid(!ui.snapToGrid); }}
  >
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="1" y="1" width="5" height="5" rx="0.5" />
      <rect x="10" y="1" width="5" height="5" rx="0.5" />
      <rect x="1" y="10" width="5" height="5" rx="0.5" />
      <rect x="10" y="10" width="5" height="5" rx="0.5" />
      <line x1="8" y1="1" x2="8" y2="15" stroke-dasharray="2 2" opacity="0.4" />
      <line x1="1" y1="8" x2="15" y2="8" stroke-dasharray="2 2" opacity="0.4" />
    </svg>
  </button>

  <!-- Grid Size -->
  <div class="toolbar-dropdown-wrapper">
    <button
      class="toolbar-btn"
      class:active={showGridMenu}
      title={t('canvas.toolbar.gridSize')}
      aria-label={t('canvas.toolbar.gridSize')}
      aria-haspopup="true"
      aria-expanded={showGridMenu}
      onclick={(e) => { e.stopPropagation(); showLayoutMenu = false; showEdgeMenu = false; showGridMenu = !showGridMenu; showEdgeVisibilityMenu = false; }}
    >
      <span class="grid-size-label">{ui.gridSize}</span>
    </button>
    {#if showGridMenu}
      <div class="toolbar-dropdown">
        {#each gridSizes as size (size)}
          <button
            class="toolbar-dropdown-item"
            class:selected={ui.gridSize === size}
            onclick={() => { ui.setGridSize(size); showGridMenu = false; }}
          >
            <span>{size}{t('canvas.toolbar.px')}</span>
            {#if ui.gridSize === size}
              <span class="check">&#10003;</span>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <div class="toolbar-separator"></div>

  <!-- Edge Visibility -->
  <div class="toolbar-dropdown-wrapper">
    <button
      class="toolbar-btn"
      class:active={showEdgeVisibilityMenu}
      class:has-hidden={hiddenEdgeCount > 0}
      title={t('canvas.toolbar.edgeVisibility')}
      aria-label={t('canvas.toolbar.edgeVisibility')}
      aria-haspopup="true"
      aria-expanded={showEdgeVisibilityMenu}
      onclick={(e) => { e.stopPropagation(); showLayoutMenu = false; showEdgeMenu = false; showGridMenu = false; showEdgeVisibilityMenu = !showEdgeVisibilityMenu; }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        {#if hiddenEdgeCount === 0}
          <!-- Eye open -->
          <path d="M1 8C1 8 3.5 3 8 3C12.5 3 15 8 15 8C15 8 12.5 13 8 13C3.5 13 1 8 1 8Z" />
          <circle cx="8" cy="8" r="2.5" />
        {:else}
          <!-- Eye with slash -->
          <path d="M1 8C1 8 3.5 3 8 3C12.5 3 15 8 15 8C15 8 12.5 13 8 13C3.5 13 1 8 1 8Z" />
          <line x1="3" y1="13" x2="13" y2="3" />
        {/if}
      </svg>
      {#if hiddenEdgeCount > 0}
        <span class="hidden-badge">{hiddenEdgeCount}</span>
      {/if}
    </button>
    {#if showEdgeVisibilityMenu}
      <div class="toolbar-dropdown edge-visibility-dropdown">
        <div class="dropdown-header">{t('canvas.toolbar.showEdges')}</div>
        <!-- All toggle -->
        <label class="visibility-toggle-item all-toggle">
          <span class="toggle-label">
            <span class="toggle-name">{t('canvas.toolbar.all')}</span>
          </span>
          <button
            class="toggle-switch"
            class:on={hiddenEdgeCount === 0}
            onclick={(e) => { e.preventDefault(); ui.setAllEdgeVisibility(hiddenEdgeCount > 0); }}
            role="switch"
            aria-checked={hiddenEdgeCount === 0}
            aria-label={t('canvas.toolbar.toggleAllEdges')}
          >
            <span class="toggle-knob"></span>
          </button>
        </label>
        <div class="toggle-divider"></div>
        {#each edgeCategoryOptions as cat (cat.id)}
          <label class="visibility-toggle-item">
            <span class="toggle-label">
              <span class="toggle-name">{t(cat.labelKey)}</span>
              <span class="toggle-desc">{t(cat.descKey)}</span>
            </span>
            <button
              class="toggle-switch"
              class:on={ui.edgeVisibility[cat.id]}
              onclick={(e) => { e.preventDefault(); ui.toggleEdgeVisibility(cat.id); }}
              role="switch"
              aria-checked={ui.edgeVisibility[cat.id]}
              aria-label={`Toggle ${t(cat.labelKey)} edges`}
            >
              <span class="toggle-knob"></span>
            </button>
          </label>
        {/each}
        <div class="toggle-divider"></div>
        <label class="visibility-toggle-item">
          <span class="toggle-label">
            <span class="toggle-name">{t('canvas.toolbar.costBadges')}</span>
            <span class="toggle-desc">{t('canvas.toolbar.nodeEstimates')}</span>
          </span>
          <button
            class="toggle-switch"
            class:on={ui.showCostBadges}
            onclick={(e) => { e.preventDefault(); ui.setShowCostBadges(!ui.showCostBadges); }}
            role="switch"
            aria-checked={ui.showCostBadges}
            aria-label={t('canvas.toolbar.toggleCostBadges')}
          >
            <span class="toggle-knob"></span>
          </button>
        </label>
        <label class="visibility-toggle-item">
          <span class="toggle-label">
            <span class="toggle-name">{t('canvas.toolbar.compactNodes')}</span>
            <span class="toggle-desc">{t('canvas.toolbar.iconOnlyView')}</span>
          </span>
          <button
            class="toggle-switch"
            class:on={ui.compactNodes}
            onclick={(e) => { e.preventDefault(); ui.setCompactNodes(!ui.compactNodes); }}
            role="switch"
            aria-checked={ui.compactNodes}
            aria-label={t('canvas.toolbar.toggleCompactNodes')}
          >
            <span class="toggle-knob"></span>
          </button>
        </label>
      </div>
    {/if}
  </div>

</div>

<style>
  .canvas-toolbar {
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 2px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 3px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
  }

  .toolbar-btn:hover:not(:disabled) {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }

  .toolbar-btn.active {
    background: var(--color-surface-hover);
    color: var(--color-accent);
  }

  .toolbar-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .toolbar-separator {
    width: 1px;
    height: 18px;
    background: var(--color-border);
    margin: 0 2px;
  }

  .toolbar-dropdown-wrapper {
    position: relative;
  }

  .toolbar-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    min-width: 150px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    padding: 4px;
    z-index: 100;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  }

  .toolbar-dropdown-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 5px 10px;
    border: none;
    border-radius: 3px;
    background: transparent;
    color: var(--color-text-muted);
    font-size: var(--font-12);
    cursor: pointer;
    text-align: left;
    gap: 8px;
  }

  .toolbar-dropdown-item:hover {
    background: var(--color-accent);
    color: var(--color-accent-text);
  }

  .toolbar-dropdown-item.selected {
    color: var(--color-text);
  }

  .layout-icon {
    font-size: var(--font-12);
    width: 16px;
    text-align: center;
  }

  .check {
    font-size: var(--font-12);
    color: var(--color-accent);
  }

  .toolbar-dropdown-item:hover .check {
    color: var(--color-accent-text);
  }

  .toolbar-btn.snap-active {
    background: var(--color-accent);
    color: var(--color-accent-text);
  }

  .toolbar-btn.snap-active:hover {
    opacity: 0.9;
  }

  .grid-size-label {
    font-size: var(--font-10);
    font-weight: 600;
    min-width: 16px;
    text-align: center;
  }

  .toolbar-btn.has-hidden {
    color: var(--color-warning, #f59e0b);
  }

  .hidden-badge {
    position: absolute;
    top: 2px;
    right: 2px;
    font-size: var(--font-8);
    font-weight: 700;
    background: var(--color-warning, #f59e0b);
    color: white;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toolbar-btn {
    position: relative;
  }

  .edge-visibility-dropdown {
    min-width: 160px;
  }

  .dropdown-header {
    font-size: var(--font-10);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
    padding: 4px 10px 6px;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 4px;
  }

  .visibility-toggle-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 10px;
    cursor: pointer;
    border-radius: 3px;
    transition: background 0.1s;
  }

  .visibility-toggle-item:hover {
    background: var(--color-surface-hover);
  }

  .visibility-toggle-item.all-toggle {
    padding-bottom: 8px;
  }

  .toggle-divider {
    height: 1px;
    background: var(--color-border);
    margin: 0 10px 6px;
  }

  .toggle-label {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .toggle-name {
    font-size: var(--font-12);
    color: var(--color-text);
  }

  .toggle-desc {
    font-size: var(--font-10);
    color: var(--color-text-muted);
  }

  .toggle-switch {
    position: relative;
    width: 32px;
    height: 18px;
    background: var(--color-border);
    border: none;
    border-radius: 9px;
    cursor: pointer;
    transition: background 0.2s;
    flex-shrink: 0;
  }

  .toggle-switch.on {
    background: var(--color-accent);
  }

  .toggle-knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    background: white;
    border-radius: 50%;
    transition: transform 0.2s;
  }

  .toggle-switch.on .toggle-knob {
    transform: translateX(14px);
  }

</style>
