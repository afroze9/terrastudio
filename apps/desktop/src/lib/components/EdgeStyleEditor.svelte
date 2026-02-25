<script lang="ts">
  import { project } from '$lib/stores/project.svelte';
  import { edgeCategoryRegistry } from '@terrastudio/core';
  import type { EdgeStyleSettings, EdgeLineStyle, EdgeMarkerType, EdgeCategoryId } from '@terrastudio/types';

  interface Props {
    settings: EdgeStyleSettings;
    categoryId: EdgeCategoryId;
    onChange: (settings: EdgeStyleSettings) => void;
  }
  let { settings, categoryId, onChange }: Props = $props();

  const LINE_STYLES: { value: EdgeLineStyle; label: string }[] = [
    { value: 'solid', label: 'Solid' },
    { value: 'dashed', label: 'Dashed' },
    { value: 'dotted', label: 'Dotted' },
  ];

  const MARKER_OPTIONS: { value: EdgeMarkerType; label: string }[] = [
    { value: 'none', label: 'None' },
    { value: 'arrow', label: 'Arrow' },
    { value: 'arrowClosed', label: 'Filled Arrow' },
    { value: 'dot', label: 'Dot' },
  ];

  // Get default line style from category definition's dashArray
  function getCategoryDefaultLineStyle(): EdgeLineStyle {
    const cat = edgeCategoryRegistry.get(categoryId);
    if (!cat) return 'solid';
    const dashArray = cat.defaultStyle.dashArray;
    if (!dashArray) return 'solid';
    if (dashArray.includes('5')) return 'dashed';
    if (dashArray.includes('2') || dashArray.includes('3')) return 'dotted';
    return 'dashed';
  }

  // Get effective default (project setting > category default)
  let effectiveLineStyle = $derived.by(() => {
    const projectSetting = project.projectConfig.edgeStyles?.[categoryId]?.lineStyle;
    return projectSetting ?? getCategoryDefaultLineStyle();
  });

  let effectiveMarker = $derived.by(() => {
    const cat = edgeCategoryRegistry.get(categoryId);
    const categoryDefault = cat?.defaultStyle.markerEnd ?? 'none';
    const projectSetting = project.projectConfig.edgeStyles?.[categoryId]?.markerEnd;
    return projectSetting ?? categoryDefault;
  });

  let effectiveThickness = $derived.by(() => {
    const cat = edgeCategoryRegistry.get(categoryId);
    const categoryDefault = cat?.defaultStyle.strokeWidth ?? 2;
    const projectSetting = project.projectConfig.edgeStyles?.[categoryId]?.thickness;
    return projectSetting ?? categoryDefault;
  });

  let effectiveAnimated = $derived.by(() => {
    const cat = edgeCategoryRegistry.get(categoryId);
    const categoryDefault = cat?.defaultStyle.animated ?? false;
    const projectSetting = project.projectConfig.edgeStyles?.[categoryId]?.animated;
    return projectSetting ?? categoryDefault;
  });

  // Map CSS variable colors to hex values for color picker
  // Muted, industry-standard palette
  const CATEGORY_DEFAULT_COLORS: Record<EdgeCategoryId, string> = {
    structural: '#6b7280',  // neutral gray - dependencies
    binding: '#7c9eb8',     // muted steel blue - data flow
    reference: '#9ca3af',   // light gray - subtle visual refs
    annotation: '#a1a1aa',  // zinc gray - user notes
  };

  let effectiveColor = $derived.by(() => {
    const categoryDefault = CATEGORY_DEFAULT_COLORS[categoryId] ?? '#6b7280';
    const projectSetting = project.projectConfig.edgeStyles?.[categoryId]?.color;
    return projectSetting ?? categoryDefault;
  });

  function update(updates: Partial<EdgeStyleSettings>) {
    const newSettings = { ...settings, ...updates };
    // Clean up undefined values
    for (const key of Object.keys(newSettings) as (keyof EdgeStyleSettings)[]) {
      if (newSettings[key] === undefined || newSettings[key] === null) {
        delete newSettings[key];
      }
    }
    onChange(newSettings);
  }

  let hasOverrides = $derived(Object.keys(settings).length > 0);
</script>

<div class="edge-style-editor">
  <div class="editor-header">
    <span class="editor-title">Style Override</span>
    {#if hasOverrides}
      <button
        class="reset-btn"
        onclick={() => onChange({})}
        title="Reset to project/category default"
      >Reset</button>
    {/if}
  </div>

  <div class="style-row">
    <label class="style-field">
      <span class="field-label">Line</span>
      <select
        class="style-select"
        value={settings.lineStyle ?? effectiveLineStyle}
        onchange={(e) => {
          const val = (e.target as HTMLSelectElement).value as EdgeLineStyle;
          // Only store if different from effective default
          update({ lineStyle: val === effectiveLineStyle ? undefined : val });
        }}
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
        value={settings.markerEnd ?? effectiveMarker}
        onchange={(e) => {
          const val = (e.target as HTMLSelectElement).value as EdgeMarkerType;
          // Only store if different from effective default
          update({ markerEnd: val === effectiveMarker ? undefined : val });
        }}
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
          value={settings.color ?? effectiveColor}
          onchange={(e) => {
            const val = (e.target as HTMLInputElement).value;
            // Only store if different from effective default
            update({ color: val.toLowerCase() === effectiveColor.toLowerCase() ? undefined : val });
          }}
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
        value={settings.thickness ?? effectiveThickness}
        oninput={(e) => {
          const val = parseFloat((e.target as HTMLInputElement).value);
          // Only store if different from effective default
          update({ thickness: isNaN(val) || val === effectiveThickness ? undefined : val });
        }}
      />
    </label>
  </div>

  <label class="style-checkbox">
    <input
      type="checkbox"
      checked={settings.animated ?? effectiveAnimated}
      onchange={(e) => {
        const checked = (e.target as HTMLInputElement).checked;
        // Only store if different from effective default
        update({ animated: checked === effectiveAnimated ? undefined : checked });
      }}
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
