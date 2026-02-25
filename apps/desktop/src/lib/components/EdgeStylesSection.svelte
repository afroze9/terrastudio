<script lang="ts">
  import { project } from '$lib/stores/project.svelte';
  import { edgeCategoryRegistry } from '@terrastudio/core';
  import type { EdgeCategoryId, EdgeStyleSettings, EdgeLineStyle, EdgeMarkerType } from '@terrastudio/types';
  import CollapsibleSection from './CollapsibleSection.svelte';

  interface Props {
    forceExpand?: boolean;
  }
  let { forceExpand = false }: Props = $props();

  const CATEGORIES: { id: EdgeCategoryId; label: string; desc: string }[] = [
    { id: 'structural', label: 'Structural', desc: 'Terraform dependencies' },
    { id: 'binding', label: 'Binding', desc: 'Data flow (secrets, outputs)' },
    { id: 'reference', label: 'Reference', desc: 'Visual property references' },
    { id: 'annotation', label: 'Annotation', desc: 'User documentation' },
  ];

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
  function getCategoryDefaultLineStyle(categoryId: EdgeCategoryId): EdgeLineStyle {
    const cat = edgeCategoryRegistry.get(categoryId);
    if (!cat) return 'solid';
    const dashArray = cat.defaultStyle.dashArray;
    if (!dashArray) return 'solid';
    if (dashArray.includes('5')) return 'dashed';
    if (dashArray.includes('2') || dashArray.includes('3')) return 'dotted';
    return 'dashed';
  }

  // Get default marker from category definition
  function getCategoryDefaultMarker(categoryId: EdgeCategoryId): EdgeMarkerType {
    const cat = edgeCategoryRegistry.get(categoryId);
    return cat?.defaultStyle.markerEnd ?? 'none';
  }

  // Get default thickness from category definition
  function getCategoryDefaultThickness(categoryId: EdgeCategoryId): number {
    const cat = edgeCategoryRegistry.get(categoryId);
    return cat?.defaultStyle.strokeWidth ?? 2;
  }

  // Get default animated from category definition
  function getCategoryDefaultAnimated(categoryId: EdgeCategoryId): boolean {
    const cat = edgeCategoryRegistry.get(categoryId);
    return cat?.defaultStyle.animated ?? false;
  }

  // Map CSS variable colors to hex values for color picker
  const CATEGORY_DEFAULT_COLORS: Record<EdgeCategoryId, string> = {
    structural: '#64748b',
    binding: '#8b5cf6',
    reference: '#94a3b8',
    annotation: '#f59e0b',
  };

  function getCategoryDefaultColor(categoryId: EdgeCategoryId): string {
    return CATEGORY_DEFAULT_COLORS[categoryId] ?? '#64748b';
  }

  function getSettings(categoryId: EdgeCategoryId): EdgeStyleSettings {
    return project.projectConfig.edgeStyles?.[categoryId] ?? {};
  }

  function updateSettings(categoryId: EdgeCategoryId, updates: Partial<EdgeStyleSettings>) {
    const current = project.projectConfig.edgeStyles ?? {};
    const categorySettings = { ...current[categoryId], ...updates };

    // Remove undefined/null values
    for (const key of Object.keys(categorySettings) as (keyof EdgeStyleSettings)[]) {
      if (categorySettings[key] === undefined || categorySettings[key] === null) {
        delete categorySettings[key];
      }
    }

    project.projectConfig.edgeStyles = {
      ...current,
      [categoryId]: Object.keys(categorySettings).length > 0 ? categorySettings : undefined,
    };
    project.markDirty();
  }

  function resetCategory(categoryId: EdgeCategoryId) {
    const current = project.projectConfig.edgeStyles ?? {};
    const { [categoryId]: _, ...rest } = current;
    project.projectConfig.edgeStyles = Object.keys(rest).length > 0 ? rest : undefined;
    project.markDirty();
  }

  function hasOverrides(categoryId: EdgeCategoryId): boolean {
    const settings = project.projectConfig.edgeStyles?.[categoryId];
    return settings !== undefined && Object.keys(settings).length > 0;
  }
</script>

<CollapsibleSection id="project-edge-styles" label="Edge Styles" {forceExpand}>
  <p class="section-hint">Override default styles for each edge category.</p>

  {#each CATEGORIES as category (category.id)}
    {@const settings = getSettings(category.id)}
    {@const hasCustom = hasOverrides(category.id)}
    {@const defaultLineStyle = getCategoryDefaultLineStyle(category.id)}
    {@const defaultMarker = getCategoryDefaultMarker(category.id)}
    {@const defaultThickness = getCategoryDefaultThickness(category.id)}
    {@const defaultAnimated = getCategoryDefaultAnimated(category.id)}
    {@const defaultColor = getCategoryDefaultColor(category.id)}
    <div class="edge-category">
      <div class="category-header">
        <span class="category-label">{category.label}</span>
        <span class="category-desc">{category.desc}</span>
        {#if hasCustom}
          <button
            class="reset-btn"
            onclick={() => resetCategory(category.id)}
            title="Reset to default"
          >Reset</button>
        {/if}
      </div>

      <div class="style-row">
        <label class="style-field">
          <span class="field-label">Line</span>
          <select
            class="style-select"
            value={settings.lineStyle ?? defaultLineStyle}
            onchange={(e) => {
              const val = (e.target as HTMLSelectElement).value as EdgeLineStyle;
              // Only store if different from default
              updateSettings(category.id, { lineStyle: val === defaultLineStyle ? undefined : val });
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
            value={settings.markerEnd ?? defaultMarker}
            onchange={(e) => {
              const val = (e.target as HTMLSelectElement).value as EdgeMarkerType;
              // Only store if different from default
              updateSettings(category.id, { markerEnd: val === defaultMarker ? undefined : val });
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
              value={settings.color ?? defaultColor}
              onchange={(e) => {
                const val = (e.target as HTMLInputElement).value;
                // Only store if different from default
                updateSettings(category.id, { color: val.toLowerCase() === defaultColor.toLowerCase() ? undefined : val });
              }}
            />
            {#if settings.color}
              <button
                class="clear-color"
                onclick={() => updateSettings(category.id, { color: undefined })}
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
            value={settings.thickness ?? defaultThickness}
            oninput={(e) => {
              const val = parseFloat((e.target as HTMLInputElement).value);
              // Only store if different from default
              updateSettings(category.id, { thickness: isNaN(val) || val === defaultThickness ? undefined : val });
            }}
          />
        </label>
      </div>

      <label class="style-checkbox">
        <input
          type="checkbox"
          checked={settings.animated ?? defaultAnimated}
          onchange={(e) => {
            const checked = (e.target as HTMLInputElement).checked;
            // Only store if different from default
            updateSettings(category.id, { animated: checked === defaultAnimated ? undefined : checked });
          }}
        />
        <span>Animated</span>
      </label>
    </div>
  {/each}
</CollapsibleSection>

<style>
  .section-hint {
    font-size: 11px;
    color: var(--color-text-muted);
    margin: 0 0 12px;
  }

  .edge-category {
    margin-bottom: 16px;
    padding: 10px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 6px;
  }
  .edge-category:last-child {
    margin-bottom: 0;
  }

  .category-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 10px;
  }
  .category-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text);
  }
  .category-desc {
    flex: 1;
    font-size: 10px;
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
