<script lang="ts">
  import { diagram } from '$lib/stores/diagram.svelte';
  import { registry } from '$lib/bootstrap';
  import ColorSwatchPicker from './ColorSwatchPicker.svelte';
  import type { NodeFormatting } from '@terrastudio/types';

  interface Props {
    nodeId: string;
  }

  let { nodeId }: Props = $props();

  let node = $derived(diagram.nodes.find((n) => n.id === nodeId));
  let formatting = $derived((node?.data.formatting as NodeFormatting | undefined) ?? {});

  let schema = $derived(
    node ? registry.getResourceSchema(node.data.typeId) : null,
  );
  let isContainer = $derived(schema?.isContainer === true);

  function update(updates: Partial<NodeFormatting>) {
    const merged = { ...formatting, ...updates };
    // Remove undefined values
    for (const key of Object.keys(merged) as (keyof NodeFormatting)[]) {
      if (merged[key] === undefined || merged[key] === null) {
        delete merged[key];
      }
    }
    diagram.updateNodeData(nodeId, {
      formatting: Object.keys(merged).length > 0 ? merged : undefined,
    });
  }

  function resetFormatting() {
    diagram.updateNodeData(nodeId, { formatting: undefined });
  }

  let hasFormatting = $derived(Object.keys(formatting).length > 0);

  // Border style options
  const BORDER_STYLES: { value: 'solid' | 'dashed' | 'dotted'; label: string }[] = [
    { value: 'solid', label: 'Solid' },
    { value: 'dashed', label: 'Dashed' },
    { value: 'dotted', label: 'Dotted' },
  ];

  // Text align options
  const TEXT_ALIGNS: { value: 'left' | 'center' | 'right'; label: string; icon: string }[] = [
    { value: 'left', label: 'Left', icon: 'M2 3h8M2 6h5M2 9h8M2 12h5' },
    { value: 'center', label: 'Center', icon: 'M1 3h10M3 6h6M1 9h10M3 12h6' },
    { value: 'right', label: 'Right', icon: 'M2 3h8M5 6h5M2 9h8M5 12h5' },
  ];

  // Font size options
  const FONT_SIZES: { value: 'small' | 'medium' | 'large'; label: string }[] = [
    { value: 'small', label: 'S' },
    { value: 'medium', label: 'M' },
    { value: 'large', label: 'L' },
  ];
</script>

<div class="node-format-panel">

  <!-- Label Formatting -->
  <div class="format-group">
    <span class="group-label">Label</span>

    <div class="format-row">
      <span class="field-label">Align</span>
      <div class="button-group">
        {#each TEXT_ALIGNS as align (align.value)}
          <button
            class="toggle-btn"
            class:active={formatting.textAlign === align.value}
            title={align.label}
            onclick={() => update({ textAlign: formatting.textAlign === align.value ? undefined : align.value })}
          >
            <svg width="12" height="14" viewBox="0 0 12 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
              <path d={align.icon} />
            </svg>
          </button>
        {/each}
      </div>
    </div>

    <div class="format-row">
      <span class="field-label">Size</span>
      <div class="button-group">
        {#each FONT_SIZES as size (size.value)}
          <button
            class="toggle-btn"
            class:active={formatting.fontSize === size.value}
            title={size.value}
            onclick={() => update({ fontSize: formatting.fontSize === size.value ? undefined : size.value })}
          >
            <span class="size-label" class:size-small={size.value === 'small'} class:size-large={size.value === 'large'}>{size.label}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="format-row">
      <span class="field-label">Style</span>
      <div class="button-group">
        <button
          class="toggle-btn"
          class:active={formatting.fontBold}
          title="Bold"
          onclick={() => update({ fontBold: formatting.fontBold ? undefined : true })}
        >
          <strong>B</strong>
        </button>
        <button
          class="toggle-btn"
          class:active={formatting.fontItalic}
          title="Italic"
          onclick={() => update({ fontItalic: formatting.fontItalic ? undefined : true })}
        >
          <em>I</em>
        </button>
      </div>
    </div>
  </div>

  <!-- Fill & Border -->
  <div class="format-group">
    <span class="group-label">Fill & Border</span>

    <div class="format-row-full">
      <ColorSwatchPicker
        label="Background"
        value={formatting.backgroundColor}
        onchange={(color) => update({ backgroundColor: color })}
      />
    </div>

    <div class="format-row-full">
      <ColorSwatchPicker
        label="Border Color"
        value={formatting.borderColor}
        onchange={(color) => update({ borderColor: color })}
      />
    </div>

    <div class="format-row">
      <span class="field-label">Border</span>
      <div class="button-group">
        {#each BORDER_STYLES as style (style.value)}
          <button
            class="toggle-btn"
            class:active={formatting.borderStyle === style.value}
            title={style.label}
            onclick={() => update({ borderStyle: formatting.borderStyle === style.value ? undefined : style.value })}
          >
            <span class="border-preview" style="border-top-style: {style.value}"></span>
          </button>
        {/each}
      </div>
    </div>

    <div class="format-row">
      <span class="field-label">Width</span>
      <input
        type="number"
        class="number-input"
        min="1"
        max="4"
        step="1"
        value={formatting.borderWidth ?? 1}
        oninput={(e) => {
          const val = parseInt((e.target as HTMLInputElement).value);
          update({ borderWidth: isNaN(val) || val === 1 ? undefined : Math.min(4, Math.max(1, val)) });
        }}
      />
    </div>

    <div class="format-row">
      <span class="field-label">Opacity</span>
      <div class="range-row">
        <input
          type="range"
          class="range-input"
          min="0.3"
          max="1"
          step="0.1"
          value={formatting.opacity ?? 1}
          oninput={(e) => {
            const val = parseFloat((e.target as HTMLInputElement).value);
            update({ opacity: val === 1 ? undefined : val });
          }}
        />
        <span class="range-value">{Math.round((formatting.opacity ?? 1) * 100)}%</span>
      </div>
    </div>
  </div>

  <!-- Container Options -->
  {#if isContainer}
    <div class="format-group">
      <span class="group-label">Container</span>

      <div class="format-row-full">
        <ColorSwatchPicker
          label="Header Color"
          value={formatting.headerColor}
          onchange={(color) => update({ headerColor: color })}
        />
      </div>

      <div class="format-row">
        <span class="field-label">Radius</span>
        <input
          type="number"
          class="number-input"
          min="0"
          max="20"
          step="1"
          value={formatting.borderRadius ?? 8}
          oninput={(e) => {
            const val = parseInt((e.target as HTMLInputElement).value);
            update({ borderRadius: isNaN(val) ? undefined : Math.min(20, Math.max(0, val)) });
          }}
        />
      </div>
    </div>
  {/if}

  <!-- Reset -->
  {#if hasFormatting}
    <button class="reset-btn" onclick={resetFormatting}>
      Reset Formatting
    </button>
  {/if}
</div>

<style>
  .node-format-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .format-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .group-label {
    font-size: var(--font-10);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
  }

  .format-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .format-row-full {
    display: flex;
    flex-direction: column;
  }

  .field-label {
    font-size: var(--font-10);
    color: var(--color-text-muted);
    font-weight: 500;
    min-width: 50px;
  }

  .button-group {
    display: flex;
    gap: 2px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    padding: 1px;
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 24px;
    border: none;
    border-radius: 3px;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: var(--font-11);
    transition: all 0.1s;
    padding: 0;
  }
  .toggle-btn:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }
  .toggle-btn.active {
    background: var(--color-accent);
    color: white;
  }

  .size-label {
    font-size: var(--font-10);
    font-weight: 600;
  }
  .size-small {
    font-size: 9px;
  }
  .size-large {
    font-size: var(--font-12);
  }

  .border-preview {
    display: block;
    width: 18px;
    border-top-width: 2px;
    border-top-color: currentColor;
  }

  .number-input {
    width: 50px;
    padding: 3px 6px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-surface);
    color: var(--color-text);
    font-size: var(--font-11);
    outline: none;
    text-align: center;
  }
  .number-input:focus {
    border-color: var(--color-accent);
  }

  .range-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
  }

  .range-input {
    flex: 1;
    height: 4px;
    accent-color: var(--color-accent);
    cursor: pointer;
  }

  .range-value {
    font-size: var(--font-10);
    color: var(--color-text-muted);
    min-width: 32px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .reset-btn {
    width: 100%;
    padding: 6px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-muted);
    font-size: var(--font-11);
    cursor: pointer;
    transition: all 0.1s;
  }
  .reset-btn:hover {
    border-color: #ef4444;
    color: #ef4444;
  }
</style>
