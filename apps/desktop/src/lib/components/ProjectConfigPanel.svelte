<script lang="ts">
  import { project } from '$lib/stores/project.svelte';
  import type { LayoutAlgorithm } from '@terrastudio/core';

  let newTagKey = $state('');
  let newTagValue = $state('');

  const layoutOptions: { value: LayoutAlgorithm; label: string; desc: string }[] = [
    { value: 'dagre', label: 'Dagre', desc: 'Hierarchical layout based on edges' },
    { value: 'hybrid', label: 'Hybrid Grid', desc: 'Grid layout with reference-aware clustering' },
  ];

  function setLayoutAlgorithm(algo: LayoutAlgorithm) {
    project.projectConfig.layoutAlgorithm = algo;
    project.markDirty();
  }

  function addTag() {
    const key = newTagKey.trim();
    const value = newTagValue.trim();
    if (!key) return;
    project.projectConfig.commonTags = {
      ...project.projectConfig.commonTags,
      [key]: value,
    };
    project.markDirty();
    newTagKey = '';
    newTagValue = '';
  }

  function removeTag(key: string) {
    const { [key]: _, ...rest } = project.projectConfig.commonTags;
    project.projectConfig.commonTags = rest;
    project.markDirty();
  }

  let tagEntries = $derived(Object.entries(project.projectConfig.commonTags));
</script>

<div class="config-panel">
  <div class="config-panel-content">
    <!-- Layout Algorithm -->
    <div class="config-section">
      <div class="group-header">Layout</div>
      <p class="section-hint">Algorithm used by Auto Layout.</p>
      <div class="layout-options">
        {#each layoutOptions as opt (opt.value)}
          <button
            class="layout-option"
            class:active={(project.projectConfig.layoutAlgorithm ?? 'dagre') === opt.value}
            onclick={() => setLayoutAlgorithm(opt.value)}
          >
            <span class="layout-option-label">{opt.label}</span>
            <span class="layout-option-desc">{opt.desc}</span>
          </button>
        {/each}
      </div>
    </div>

    <!-- Common Tags Section -->
    <div class="config-section">
      <div class="group-header">Common Tags</div>
      <p class="section-hint">Applied to all resources that support tags.</p>

      {#each tagEntries as [key, value] (key)}
        <div class="tag-row">
          <span class="tag-key">{key}</span>
          <span class="tag-value">{value}</span>
          <button
            class="remove-btn"
            onclick={() => removeTag(key)}
            aria-label="Remove tag"
          >&times;</button>
        </div>
      {/each}

      <div class="add-tag-row">
        <input
          type="text"
          class="tag-input"
          placeholder="key"
          bind:value={newTagKey}
          onkeydown={(e) => { if (e.key === 'Enter') addTag(); }}
        />
        <input
          type="text"
          class="tag-input"
          placeholder="value"
          bind:value={newTagValue}
          onkeydown={(e) => { if (e.key === 'Enter') addTag(); }}
        />
        <button
          class="add-btn"
          onclick={addTag}
          disabled={!newTagKey.trim()}
        >+</button>
      </div>
    </div>

  </div>
</div>

<style>
  .config-panel {
    width: 100%;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }
  .config-panel-content {
    padding: 12px 16px;
    flex: 1;
    overflow-y: auto;
  }
  .config-section {
    margin-bottom: 20px;
  }
  .group-header {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-accent);
    padding: 8px 0 6px;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 8px;
  }
  .section-hint {
    font-size: 11px;
    color: var(--color-text-muted);
    margin: 0 0 8px;
  }

  /* Layout algorithm */
  .layout-options {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .layout-option {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 8px 10px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    text-align: left;
    transition: background 0.1s, border-color 0.1s;
  }
  .layout-option:hover {
    background: var(--color-surface-hover);
  }
  .layout-option.active {
    border-color: var(--color-accent);
    color: var(--color-text);
    background: var(--color-surface-hover);
  }
  .layout-option-label {
    font-size: 12px;
    font-weight: 500;
  }
  .layout-option-desc {
    font-size: 10px;
    color: var(--color-text-muted);
    margin-top: 2px;
  }

  /* Tags */
  .tag-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 0;
    border-bottom: 1px solid var(--color-border);
  }
  .tag-row:last-of-type {
    border-bottom: none;
  }
  .tag-key {
    font-size: 12px;
    font-weight: 500;
    font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
    color: var(--color-text);
  }
  .tag-value {
    flex: 1;
    font-size: 12px;
    color: var(--color-text-muted);
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .remove-btn {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 14px;
    cursor: pointer;
    padding: 0 2px;
    line-height: 1;
    flex-shrink: 0;
  }
  .remove-btn:hover {
    color: #ef4444;
  }
  .add-tag-row {
    display: flex;
    gap: 4px;
    margin-top: 8px;
  }
  .tag-input {
    flex: 1;
    padding: 4px 8px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 11px;
    outline: none;
    min-width: 0;
  }
  .tag-input:focus {
    border-color: var(--color-accent);
  }
  .add-btn {
    padding: 4px 10px;
    border: 1px solid var(--color-accent);
    border-radius: 4px;
    background: transparent;
    color: var(--color-accent);
    font-size: 13px;
    cursor: pointer;
    flex-shrink: 0;
  }
  .add-btn:hover:not(:disabled) {
    background: var(--color-accent);
    color: white;
  }
  .add-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
