<script lang="ts">
  interface Props {
    value: string | undefined;
    onchange: (color: string | undefined) => void;
    label: string;
  }

  let { value, onchange, label }: Props = $props();

  const PRESETS = [
    { color: undefined, label: 'Default' },
    { color: '#ef4444', label: 'Red' },
    { color: '#f59e0b', label: 'Amber' },
    { color: '#22c55e', label: 'Green' },
    { color: '#3b82f6', label: 'Blue' },
    { color: '#8b5cf6', label: 'Purple' },
    { color: '#ec4899', label: 'Pink' },
    { color: '#6b7280', label: 'Gray' },
    { color: '#1e293b', label: 'Dark' },
  ];

  let customHex = $state(value && !PRESETS.some((p) => p.color === value) ? value : '');

  function onCustomInput(e: Event) {
    const raw = (e.target as HTMLInputElement).value;
    customHex = raw;
    // Auto-apply if it looks like a valid hex color
    const normalized = raw.startsWith('#') ? raw : `#${raw}`;
    if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
      onchange(normalized.toLowerCase());
    }
  }

  function isSelected(presetColor: string | undefined): boolean {
    if (presetColor === undefined && value === undefined) return true;
    if (presetColor === undefined || value === undefined) return false;
    return presetColor.toLowerCase() === value.toLowerCase();
  }
</script>

<div class="color-swatch-picker">
  <span class="picker-label">{label}</span>
  <div class="swatch-grid">
    {#each PRESETS as preset (preset.label)}
      <button
        class="swatch"
        class:selected={isSelected(preset.color)}
        class:swatch-none={preset.color === undefined}
        style={preset.color ? `background-color: ${preset.color}` : ''}
        title={preset.label}
        onclick={() => {
          customHex = '';
          onchange(preset.color);
        }}
      >
        {#if preset.color === undefined}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
            <line x1="2" y1="2" x2="10" y2="10" />
            <line x1="10" y1="2" x2="2" y2="10" />
          </svg>
        {/if}
      </button>
    {/each}
  </div>
  <div class="custom-hex-row">
    <span class="hex-prefix">#</span>
    <input
      type="text"
      class="hex-input"
      placeholder="Custom hex"
      maxlength="7"
      value={customHex.replace(/^#/, '')}
      oninput={onCustomInput}
    />
  </div>
</div>

<style>
  .color-swatch-picker {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .picker-label {
    font-size: var(--font-10);
    color: var(--color-text-muted);
    font-weight: 500;
  }
  .swatch-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .swatch {
    width: 22px;
    height: 22px;
    border-radius: 4px;
    border: 2px solid transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    transition: border-color 0.1s, transform 0.1s;
  }
  .swatch:hover {
    transform: scale(1.15);
  }
  .swatch.selected {
    border-color: var(--color-accent);
    box-shadow: 0 0 0 1px var(--color-accent);
  }
  .swatch-none {
    background: var(--color-surface);
    border-color: var(--color-border);
    color: var(--color-text-muted);
  }
  .swatch-none.selected {
    border-color: var(--color-accent);
  }
  .custom-hex-row {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-top: 2px;
  }
  .hex-prefix {
    font-size: var(--font-10);
    color: var(--color-text-muted);
    font-weight: 500;
  }
  .hex-input {
    flex: 1;
    padding: 2px 4px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-surface);
    color: var(--color-text);
    font-size: var(--font-10);
    font-family: monospace;
    outline: none;
    width: 80px;
  }
  .hex-input:focus {
    border-color: var(--color-accent);
  }
</style>
