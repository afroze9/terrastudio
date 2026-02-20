<script lang="ts">
  import { ui } from '$lib/stores/ui.svelte';
  import { getAllPalettes, validateCustomTheme, importCustomTheme } from '$lib/themes/theme-engine';
  import type { PaletteId, CustomThemeFile } from '$lib/themes/types';
  import { open as openDialog } from '@tauri-apps/plugin-dialog';
  import { readTextFile } from '@tauri-apps/plugin-fs';

  let { onclose }: { onclose?: () => void } = $props();

  let palettes = $derived(getAllPalettes());
  let importError = $state('');

  function selectPalette(id: string) {
    ui.setPalette(id as PaletteId);
    onclose?.();
  }

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
      onclose?.();
    } catch (e) {
      importError = String(e);
    }
  }
</script>

<div class="palette-selector">
  <div class="palette-header">Color Palette</div>
  <div class="palette-list">
    {#each palettes as palette (palette.id)}
      <button
        class="palette-item"
        class:active={ui.paletteId === palette.id}
        onclick={() => selectPalette(palette.id)}
      >
        <span class="swatch" style="background: {palette.previewAccent}"></span>
        <span class="palette-name">{palette.name}</span>
        {#if ui.paletteId === palette.id}
          <span class="check">&#10003;</span>
        {/if}
      </button>
    {/each}
  </div>
  <div class="palette-footer">
    <button class="import-btn" onclick={handleImport}>
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 3v10" />
        <path d="M3 8h10" />
      </svg>
      Import Theme...
    </button>
    {#if importError}
      <div class="import-error">{importError}</div>
    {/if}
  </div>
</div>

<style>
  .palette-selector {
    min-width: 180px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    box-shadow: 0 4px 16px var(--color-shadow);
    overflow: hidden;
  }
  .palette-header {
    padding: 6px 12px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--color-text-muted);
    border-bottom: 1px solid var(--color-border);
  }
  .palette-list {
    padding: 4px;
    max-height: 320px;
    overflow-y: auto;
  }
  .palette-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 5px 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 12px;
    cursor: pointer;
    text-align: left;
  }
  .palette-item:hover {
    background: var(--color-accent);
    color: white;
  }
  .palette-item.active {
    color: var(--color-text);
  }
  .palette-item:hover .check {
    color: white;
  }
  .swatch {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .palette-name {
    flex: 1;
  }
  .check {
    font-size: 12px;
    color: var(--color-accent);
  }
  .palette-footer {
    border-top: 1px solid var(--color-border);
    padding: 4px;
  }
  .import-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 5px 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 12px;
    cursor: pointer;
  }
  .import-btn:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }
  .import-error {
    padding: 4px 8px;
    font-size: 10px;
    color: #ef4444;
  }
</style>
