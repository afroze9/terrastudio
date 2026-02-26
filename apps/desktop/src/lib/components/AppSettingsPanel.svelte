<script lang="ts">
  import { ui, type EdgeStyle } from '$lib/stores/ui.svelte';
  import { getAllPalettes, validateCustomTheme, importCustomTheme } from '$lib/themes/theme-engine';
  import type { PaletteId, CustomThemeFile } from '$lib/themes/types';
  import { open as openDialog } from '@tauri-apps/plugin-dialog';
  import { readTextFile } from '@tauri-apps/plugin-fs';
  import CollapsibleSection from './CollapsibleSection.svelte';
  import SearchBox from './SearchBox.svelte';

  let searchQuery = $state('');

  function sectionVisible(label: string) {
    return !searchQuery || label.toLowerCase().includes(searchQuery.toLowerCase());
  }

  let palettes = $derived(getAllPalettes());
  let importError = $state('');

  const edgeOptions: { value: EdgeStyle; label: string }[] = [
    { value: 'default', label: 'Bezier' },
    { value: 'smoothstep', label: 'Smooth Step' },
    { value: 'step', label: 'Step' },
    { value: 'straight', label: 'Straight' },
  ];

  const gridSizes = [10, 15, 20, 25, 30, 40, 50];

  async function handleImport() {
    importError = '';
    try {
      const selected = await openDialog({
        title: 'Import Custom Theme',
        filters: [{ name: 'JSON Theme', extensions: ['json'] }],
      });
      if (!selected) return;

      const content = await readTextFile(selected);
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        importError = 'File is not valid JSON';
        return;
      }

      const error = validateCustomTheme(parsed);
      if (error) {
        importError = error;
        return;
      }

      const newId = importCustomTheme(parsed as CustomThemeFile);
      ui.setPalette(newId);
    } catch (e) {
      importError = String(e);
    }
  }
</script>

<div class="settings-panel">
  <SearchBox bind:value={searchQuery} placeholder="Search settings..." />

  <!-- Appearance -->
  {#if sectionVisible('Appearance')}
  <CollapsibleSection id="app-appearance" label="Appearance" forceExpand={!!searchQuery}>
    <div class="setting-row">
      <span class="setting-label">Mode</span>
      <div class="toggle-group">
        <button
          class="toggle-btn"
          class:active={ui.theme === 'dark'}
          onclick={() => { if (ui.theme !== 'dark') ui.toggleTheme(); }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M13.5 8.5C13.5 11.81 10.81 14.5 7.5 14.5C4.19 14.5 1.5 11.81 1.5 8.5C1.5 5.19 4.19 2.5 7.5 2.5C7.5 2.5 6.5 5 8 7C9.5 9 12 8.5 12 8.5C12 8.5 13.5 8.17 13.5 8.5Z" />
          </svg>
          Dark
        </button>
        <button
          class="toggle-btn"
          class:active={ui.theme === 'light'}
          onclick={() => { if (ui.theme !== 'light') ui.toggleTheme(); }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
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
          Light
        </button>
      </div>
    </div>

    <div class="setting-row palette-row">
      <span class="setting-label">Color Palette</span>
      <div class="palette-grid">
        {#each palettes as palette (palette.id)}
          <button
            class="palette-chip"
            class:active={ui.paletteId === palette.id}
            title={palette.name}
            onclick={() => ui.setPalette(palette.id as PaletteId)}
          >
            <span class="chip-swatch" style="background: {palette.previewAccent}"></span>
            <span class="chip-name">{palette.name}</span>
          </button>
        {/each}
      </div>
      <button class="import-link" onclick={handleImport}>
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 3v10" />
          <path d="M3 8h10" />
        </svg>
        Import custom theme...
      </button>
      {#if importError}
        <div class="error-msg">{importError}</div>
      {/if}
    </div>
  </CollapsibleSection>
  {/if}

  <!-- Canvas -->
  {#if sectionVisible('Canvas')}
  <CollapsibleSection id="app-canvas" label="Canvas" forceExpand={!!searchQuery}>
    <div class="setting-row">
      <span class="setting-label">Snap to Grid</span>
      <button
        class="switch"
        class:on={ui.snapToGrid}
        onclick={() => ui.setSnapToGrid(!ui.snapToGrid)}
        role="switch"
        aria-label="Toggle snap to grid"
        aria-checked={ui.snapToGrid}
      >
        <span class="switch-thumb"></span>
      </button>
    </div>

    <div class="setting-row">
      <span class="setting-label">Grid Size</span>
      <div class="select-group">
        {#each gridSizes as size (size)}
          <button
            class="select-btn"
            class:active={ui.gridSize === size}
            onclick={() => ui.setGridSize(size)}
          >
            {size}
          </button>
        {/each}
      </div>
    </div>

    <div class="setting-row">
      <span class="setting-label">Edge Style</span>
      <div class="select-group">
        {#each edgeOptions as opt (opt.value)}
          <button
            class="select-btn"
            class:active={ui.edgeType === opt.value}
            onclick={() => ui.setEdgeType(opt.value)}
          >
            {opt.label}
          </button>
        {/each}
      </div>
    </div>
  </CollapsibleSection>
  {/if}

  <!-- Cost -->
  {#if sectionVisible('Cost')}
  <CollapsibleSection id="app-cost" label="Cost Estimates" forceExpand={!!searchQuery}>
    <div class="setting-row">
      <span class="setting-label">Show cost badges on nodes</span>
      <button
        class="switch"
        class:on={ui.showCostBadges}
        onclick={() => ui.setShowCostBadges(!ui.showCostBadges)}
        role="switch"
        aria-label="Toggle cost badges on nodes"
        aria-checked={ui.showCostBadges}
      >
        <span class="switch-thumb"></span>
      </button>
    </div>
  </CollapsibleSection>
  {/if}
</div>

<style>
  .settings-panel {
    display: flex;
    flex-direction: column;
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    gap: 8px;
  }

  .setting-row.palette-row {
    flex-direction: column;
    align-items: stretch;
  }

  .setting-label {
    font-size: 12px;
    color: var(--color-text);
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* Dark/Light toggle */
  .toggle-group {
    display: flex;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    overflow: hidden;
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 11px;
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
  }

  .toggle-btn:first-child {
    border-right: 1px solid var(--color-border);
  }

  .toggle-btn.active {
    background: var(--color-accent);
    color: white;
  }

  .toggle-btn:not(.active):hover {
    background: var(--color-surface-hover);
  }

  /* Palette grid */
  .palette-grid {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: 6px;
  }

  .palette-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 8px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 12px;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s, border-color 0.1s;
  }

  .palette-chip:hover {
    background: var(--color-surface-hover);
  }

  .palette-chip.active {
    border-color: var(--color-accent);
    color: var(--color-text);
    background: var(--color-surface-hover);
  }

  .chip-swatch {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .chip-name {
    flex: 1;
  }

  .import-link {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
    padding: 3px 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 11px;
    cursor: pointer;
  }

  .import-link:hover {
    color: var(--color-text);
    background: var(--color-surface-hover);
  }

  .error-msg {
    font-size: 10px;
    color: #ef4444;
    padding: 2px 8px;
  }

  /* Switch toggle */
  .switch {
    width: 32px;
    height: 18px;
    border-radius: 9px;
    border: 1px solid var(--color-border);
    background: var(--color-surface-hover);
    cursor: pointer;
    position: relative;
    transition: background 0.15s, border-color 0.15s;
    padding: 0;
    flex-shrink: 0;
  }

  .switch.on {
    background: var(--color-accent);
    border-color: var(--color-accent);
  }

  .switch-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: white;
    transition: transform 0.15s;
  }

  .switch.on .switch-thumb {
    transform: translateX(14px);
  }

  /* Select button group */
  .select-group {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
  }

  .select-btn {
    padding: 2px 7px;
    border: 1px solid var(--color-border);
    border-radius: 3px;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 10px;
    cursor: pointer;
    transition: background 0.1s, color 0.1s, border-color 0.1s;
  }

  .select-btn:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }

  .select-btn.active {
    background: var(--color-accent);
    color: white;
    border-color: var(--color-accent);
  }
</style>
