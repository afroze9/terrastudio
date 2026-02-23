<script lang="ts">
  import { diagram } from '$lib/stores/diagram.svelte';
  import { ui, type EdgeStyle } from '$lib/stores/ui.svelte';
  import { project } from '$lib/stores/project.svelte';
  import { registry } from '$lib/bootstrap';
  import { saveDiagram } from '$lib/services/project-service';
  import { autoLayout, type LayoutDirection } from '$lib/services/layout-service';

  let showLayoutMenu = $state(false);
  let showEdgeMenu = $state(false);
  let showGridMenu = $state(false);

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
    }
  }
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
      onclick={(e) => { e.stopPropagation(); showLayoutMenu = false; showEdgeMenu = false; showGridMenu = !showGridMenu; }}
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
</style>
