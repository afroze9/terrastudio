<script lang="ts">
  import { diagram } from '$lib/stores/diagram.svelte';
  import { ui, type EdgeStyle } from '$lib/stores/ui.svelte';
  import { project } from '$lib/stores/project.svelte';
  import { cost } from '$lib/stores/cost.svelte';
  import { registry } from '$lib/bootstrap';
  import { saveDiagram } from '$lib/services/project-service';
  import { autoLayout, type LayoutDirection } from '$lib/services/layout-service';
  import type { EdgeCategoryId } from '@terrastudio/types';

  let showLayoutMenu = $state(false);
  let showEdgeMenu = $state(false);
  let showGridMenu = $state(false);
  let showEdgeVisibilityMenu = $state(false);

  const edgeCategoryOptions: { id: EdgeCategoryId; label: string; desc: string }[] = [
    { id: 'structural', label: 'Structural', desc: 'Dependencies' },
    { id: 'binding', label: 'Binding', desc: 'Data flow' },
    { id: 'reference', label: 'Reference', desc: 'Property refs' },
    { id: 'annotation', label: 'Annotation', desc: 'Notes' },
  ];

  const gridSizes = [10, 15, 20, 25, 30, 40, 50];

  const layoutOptions: { value: LayoutDirection; label: string; icon: string }[] = [
    { value: 'TB', label: 'Top to Bottom', icon: '↓' },
    { value: 'LR', label: 'Left to Right', icon: '→' },
    { value: 'BT', label: 'Bottom to Top', icon: '↑' },
    { value: 'RL', label: 'Right to Left', icon: '←' },
  ];

  const edgeOptions: { value: EdgeStyle; label: string }[] = [
    { value: 'default', label: 'Bezier' },
    { value: 'smoothstep', label: 'Smooth Step' },
    { value: 'step', label: 'Step' },
    { value: 'straight', label: 'Straight' },
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

  const costChipLabel = $derived.by(() => {
    if (!cost.hasPrices) return null;
    const total = cost.totalMonthly;
    if (total === null) return 'Cost: see panel';
    return `~$${total < 100 ? total.toFixed(0) : Math.round(total)}/mo`;
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<svelte:window onclick={closeMenus} />

<div class="canvas-toolbar">
  <!-- Save -->
  <button
    class="toolbar-btn"
    title="Save (Ctrl+S)"
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
    title="Undo (Ctrl+Z)"
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
    title="Redo (Ctrl+Y)"
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
      title="Auto Layout"
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
            <span>{opt.label}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Fit View -->
  <button
    class="toolbar-btn"
    title="Fit View"
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
      title="Edge Style"
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
            <span>{opt.label}</span>
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
    title={ui.snapToGrid ? `Snap to Grid (${ui.gridSize}px) — Click to disable` : 'Snap to Grid — Click to enable'}
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
      title="Grid Size"
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
            <span>{size}px</span>
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
      title="Edge Visibility"
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
        <div class="dropdown-header">Show Edges</div>
        <!-- All toggle -->
        <label class="visibility-toggle-item all-toggle">
          <span class="toggle-label">
            <span class="toggle-name">All</span>
          </span>
          <button
            class="toggle-switch"
            class:on={hiddenEdgeCount === 0}
            onclick={(e) => { e.preventDefault(); ui.setAllEdgeVisibility(hiddenEdgeCount > 0); }}
            role="switch"
            aria-checked={hiddenEdgeCount === 0}
            aria-label="Toggle all edge categories"
          >
            <span class="toggle-knob"></span>
          </button>
        </label>
        <div class="toggle-divider"></div>
        {#each edgeCategoryOptions as cat (cat.id)}
          <label class="visibility-toggle-item">
            <span class="toggle-label">
              <span class="toggle-name">{cat.label}</span>
              <span class="toggle-desc">{cat.desc}</span>
            </span>
            <button
              class="toggle-switch"
              class:on={ui.edgeVisibility[cat.id]}
              onclick={(e) => { e.preventDefault(); ui.toggleEdgeVisibility(cat.id); }}
              role="switch"
              aria-checked={ui.edgeVisibility[cat.id]}
              aria-label={`Toggle ${cat.label} edges`}
            >
              <span class="toggle-knob"></span>
            </button>
          </label>
        {/each}
      </div>
    {/if}
  </div>

  {#if costChipLabel}
    <div class="toolbar-separator"></div>
    <button
      class="toolbar-btn cost-chip-btn"
      title="Cost estimates — click to open Cost panel"
      onclick={() => ui.setActiveView('cost')}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
      <span class="cost-chip-label">{costChipLabel}</span>
    </button>
  {/if}

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
    font-size: 12px;
    cursor: pointer;
    text-align: left;
    gap: 8px;
  }

  .toolbar-dropdown-item:hover {
    background: var(--color-accent);
    color: white;
  }

  .toolbar-dropdown-item.selected {
    color: var(--color-text);
  }

  .layout-icon {
    font-size: 12px;
    width: 16px;
    text-align: center;
  }

  .check {
    font-size: 12px;
    color: var(--color-accent);
  }

  .toolbar-dropdown-item:hover .check {
    color: white;
  }

  .toolbar-btn.snap-active {
    background: var(--color-accent);
    color: white;
  }

  .toolbar-btn.snap-active:hover {
    opacity: 0.9;
  }

  .grid-size-label {
    font-size: 10px;
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
    font-size: 8px;
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
    font-size: 10px;
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
    font-size: 12px;
    color: var(--color-text);
  }

  .toggle-desc {
    font-size: 10px;
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

  .cost-chip-btn {
    width: auto;
    padding: 0 8px;
    gap: 4px;
    font-size: 11px;
    font-weight: 500;
    color: var(--color-accent);
    white-space: nowrap;
  }
  .cost-chip-btn:hover:not(:disabled) {
    color: var(--color-accent);
  }
  .cost-chip-label {
    font-size: 11px;
    font-weight: 600;
  }
</style>
