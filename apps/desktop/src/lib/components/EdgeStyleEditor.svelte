<script lang="ts">
  import type { EdgeStyleSettings, EdgeLineStyle, EdgeMarkerType } from '@terrastudio/types';

  interface Props {
    settings: EdgeStyleSettings;
    onChange: (settings: EdgeStyleSettings) => void;
  }
  let { settings, onChange }: Props = $props();

  const LINE_STYLES: { value: EdgeLineStyle | ''; label: string }[] = [
    { value: '', label: 'Default' },
    { value: 'solid', label: 'Solid' },
    { value: 'dashed', label: 'Dashed' },
    { value: 'dotted', label: 'Dotted' },
  ];

  const MARKER_OPTIONS: { value: EdgeMarkerType | ''; label: string }[] = [
    { value: '', label: 'Default' },
    { value: 'none', label: 'None' },
    { value: 'arrow', label: 'Arrow' },
    { value: 'arrowClosed', label: 'Filled Arrow' },
    { value: 'dot', label: 'Dot' },
  ];

  function update(updates: Partial<EdgeStyleSettings>) {
    const newSettings = { ...settings, ...updates };
    // Clean up undefined values
    for (const key of Object.keys(newSettings) as (keyof EdgeStyleSettings)[]) {
      if (newSettings[key] === undefined || newSettings[key] === null || newSettings[key] === '') {
        delete newSettings[key];
      }
    }
    onChange(newSettings);
  }

  let hasOverrides = $derived(Object.keys(settings).length > 0);
</script>

<div class="edge-style-editor">
  <div class="editor-header">
    <span class="editor-title">Style</span>
    {#if hasOverrides}
      <button
        class="reset-btn"
        onclick={() => onChange({})}
        title="Reset to category default"
      >Reset</button>
    {/if}
  </div>

  <div class="style-row">
    <label class="style-field">
      <span class="field-label">Line</span>
      <select
        class="style-select"
        value={settings.lineStyle ?? ''}
        onchange={(e) => update({ lineStyle: (e.target as HTMLSelectElement).value as EdgeLineStyle || undefined })}
      >
        {#each LINE_STYLES as opt (opt.value)}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
    </label>

    <label class="style-field">
      <span class="field-label">Arrow</span>
      <select
        class="style-select"
        value={settings.markerEnd ?? ''}
        onchange={(e) => update({ markerEnd: (e.target as HTMLSelectElement).value as EdgeMarkerType || undefined })}
      >
        {#each MARKER_OPTIONS as opt (opt.value)}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
    </label>
  </div>

  <div class="style-row">
    <label class="style-field">
      <span class="field-label">Color</span>
      <div class="color-input-wrapper">
        <input
          type="color"
          class="color-picker"
          value={settings.color ?? '#64748b'}
          onchange={(e) => update({ color: (e.target as HTMLInputElement).value })}
        />
        {#if settings.color}
          <button
            class="clear-color"
            onclick={() => update({ color: undefined })}
            title="Reset to default"
          >&times;</button>
        {/if}
      </div>
    </label>

    <label class="style-field">
      <span class="field-label">Width</span>
      <input
        type="number"
        class="style-number"
        min="1"
        max="5"
        step="0.5"
        value={settings.thickness ?? ''}
        placeholder="2"
        oninput={(e) => {
          const val = parseFloat((e.target as HTMLInputElement).value);
          update({ thickness: isNaN(val) ? undefined : val });
        }}
      />
    </label>
  </div>

  <label class="style-checkbox">
    <input
      type="checkbox"
      checked={settings.animated ?? false}
      onchange={(e) => update({ animated: (e.target as HTMLInputElement).checked || undefined })}
    />
    <span>Animated</span>
  </label>
</div>

<style>
  .edge-style-editor {
    margin-top: 12px;
    padding: 10px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 6px;
  }

  .editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }
  .editor-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
  }
  .reset-btn {
    font-size: 10px;
    padding: 2px 6px;
    border: 1px solid var(--color-border);
    border-radius: 3px;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 0.1s;
  }
  .reset-btn:hover {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }

  .style-row {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }

  .style-field {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .field-label {
    font-size: 10px;
    color: var(--color-text-muted);
    font-weight: 500;
  }

  .style-select,
  .style-number {
    padding: 4px 6px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 11px;
    outline: none;
    width: 100%;
    box-sizing: border-box;
  }
  .style-select:focus,
  .style-number:focus {
    border-color: var(--color-accent);
  }

  .color-input-wrapper {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .color-picker {
    width: 32px;
    height: 24px;
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    cursor: pointer;
    background: none;
  }
  .color-picker::-webkit-color-swatch-wrapper {
    padding: 2px;
  }
  .color-picker::-webkit-color-swatch {
    border: none;
    border-radius: 2px;
  }
  .clear-color {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 14px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
  }
  .clear-color:hover {
    color: #ef4444;
  }

  .style-checkbox {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--color-text);
    cursor: pointer;
  }
  .style-checkbox input[type='checkbox'] {
    accent-color: var(--color-accent);
  }
</style>
