<script lang="ts">
  let { open, onclose }: { open: boolean; onclose: () => void } = $props();

  const groups = [
    {
      label: 'File',
      icon: `<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>`,
      shortcuts: [
        { label: 'New Project',    keys: ['Ctrl', 'N'] },
        { label: 'Open Project',   keys: ['Ctrl', 'O'] },
        { label: 'Save',           keys: ['Ctrl', 'S'] },
        { label: 'Close Tab',      keys: ['Ctrl', 'W'] },
        { label: 'Close Project',  keys: ['Ctrl', '⇧', 'W'] },
      ],
    },
    {
      label: 'Canvas',
      icon: `<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>`,
      shortcuts: [
        { label: 'Undo',           keys: ['Ctrl', 'Z'] },
        { label: 'Redo',           keys: ['Ctrl', 'Y'] },
        { label: 'Select All',     keys: ['Ctrl', 'A'] },
        { label: 'Copy',           keys: ['Ctrl', 'C'] },
        { label: 'Paste',          keys: ['Ctrl', 'V'] },
        { label: 'Duplicate',      keys: ['Ctrl', 'D'] },
        { label: 'Delete Selected', keys: ['Del'] },
        { label: 'Fit View',       keys: ['Ctrl', '0'] },
      ],
    },
    {
      label: 'View',
      icon: `<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>`,
      shortcuts: [
        { label: 'Toggle Side Panel', keys: ['Ctrl', 'B'] },
        { label: 'Toggle Terminal',   keys: ['Ctrl', '`'] },
        { label: 'Focus Search',      keys: ['Ctrl', 'F'] },
        { label: 'Resources',         keys: ['Alt', '1'] },
        { label: 'Terraform',         keys: ['Alt', '2'] },
        { label: 'Project Settings',  keys: ['Alt', '3'] },
        { label: 'App Settings',      keys: ['Ctrl', ','] },
      ],
    },
  ];
</script>

<svelte:window onkeydown={(e) => { if (open && e.key === 'Escape') onclose(); }} />

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="backdrop" onclick={onclose}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <span class="modal-title">Keyboard Shortcuts</span>
        <button class="close-btn" onclick={onclose} aria-label="Close">&#215;</button>
      </div>
      <div class="columns">
        {#each groups as group}
          <div class="column">
            <div class="group-header">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                {@html group.icon}
              </svg>
              <span>{group.label}</span>
            </div>
            <div class="shortcut-list">
              {#each group.shortcuts as shortcut}
                <div class="shortcut-row">
                  <span class="shortcut-label">{shortcut.label}</span>
                  <span class="keys">
                    {#each shortcut.keys as key, i}
                      {#if i > 0}<span class="key-plus">+</span>{/if}
                      <kbd>{key}</kbd>
                    {/each}
                  </span>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }

  .modal {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    width: min(780px, 95vw);
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    border-bottom: 1px solid var(--color-border);
  }

  .modal-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text);
    letter-spacing: 0.02em;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    transition: background 0.1s, color 0.1s;
  }
  .close-btn:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }

  .columns {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0;
    padding: 16px;
    column-gap: 8px;
  }

  .column {
    padding: 0 12px;
    border-right: 1px solid var(--color-border);
  }
  .column:last-child {
    border-right: none;
  }

  .group-header {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-accent);
    padding-bottom: 10px;
    margin-bottom: 4px;
    border-bottom: 1px solid var(--color-border);
  }

  .shortcut-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-top: 6px;
  }

  .shortcut-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 5px 4px;
    border-radius: 4px;
    gap: 8px;
  }
  .shortcut-row:hover {
    background: var(--color-surface-hover);
  }

  .shortcut-label {
    font-size: 12px;
    color: var(--color-text-muted);
    flex: 1;
  }

  .keys {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  .key-plus {
    font-size: 10px;
    color: var(--color-text-muted);
    opacity: 0.5;
    margin: 0 1px;
  }

  kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 20px;
    padding: 0 5px;
    font-family: inherit;
    font-size: 11px;
    color: var(--color-text);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    box-shadow: 0 1px 0 var(--color-border);
    white-space: nowrap;
  }
</style>
