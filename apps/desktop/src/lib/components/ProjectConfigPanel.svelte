<script lang="ts">
  import { project } from '$lib/stores/project.svelte';
  import { terraform } from '$lib/stores/terraform.svelte';

  let newTagKey = $state('');
  let newTagValue = $state('');

  // Debounce timer for variable value changes
  let varDebounceTimer: ReturnType<typeof setTimeout> | null = null;

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

  function onVariableValueChange(varName: string, value: string) {
    if (varDebounceTimer) clearTimeout(varDebounceTimer);
    varDebounceTimer = setTimeout(() => {
      project.projectConfig.variableValues = {
        ...project.projectConfig.variableValues,
        [varName]: value,
      };
      project.markDirty();
    }, 300);
  }

  let tagEntries = $derived(Object.entries(project.projectConfig.commonTags));
</script>

<div class="config-panel">
  <div class="config-panel-content">
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

    <!-- Variables Section -->
    <div class="config-section">
      <div class="group-header">Variables</div>

      {#if terraform.collectedVariables.length === 0}
        <p class="section-hint">Run Generate to see collected variables.</p>
      {:else}
        <p class="section-hint">Set values for terraform.tfvars.</p>

        {#each terraform.collectedVariables as v (v.name)}
          {@const currentValue = project.projectConfig.variableValues[v.name] ?? ''}
          {@const hasDefault = v.defaultValue !== undefined && v.defaultValue !== ''}
          {@const isMissing = !hasDefault && !currentValue}
          <div class="var-row" class:var-missing={isMissing}>
            <div class="var-header">
              <span class="var-name">{v.name}</span>
              <span class="var-type-badge">{v.type}</span>
            </div>
            {#if v.description}
              <span class="var-desc">{v.description}</span>
            {/if}
            {#if hasDefault}
              <span class="var-default">default: {v.defaultValue}</span>
            {/if}
            <input
              type="text"
              class="var-input"
              placeholder={hasDefault ? String(v.defaultValue) : 'required'}
              value={currentValue}
              oninput={(e) => onVariableValueChange(v.name, (e.target as HTMLInputElement).value)}
            />
          </div>
        {/each}
      {/if}
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

  /* Variables */
  .var-row {
    padding: 8px 0;
    border-bottom: 1px solid var(--color-border);
  }
  .var-row:last-child {
    border-bottom: none;
  }
  .var-missing {
    border-left: 2px solid #f59e0b;
    padding-left: 8px;
  }
  .var-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 2px;
  }
  .var-name {
    font-size: 12px;
    font-weight: 500;
    font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
    color: var(--color-text);
  }
  .var-type-badge {
    font-size: 9px;
    padding: 1px 5px;
    border-radius: 3px;
    background: rgba(59, 130, 246, 0.12);
    color: #3b82f6;
    font-weight: 500;
  }
  .var-desc {
    display: block;
    font-size: 11px;
    color: var(--color-text-muted);
    margin-bottom: 4px;
  }
  .var-default {
    display: block;
    font-size: 10px;
    color: var(--color-text-muted);
    font-style: italic;
    margin-bottom: 4px;
  }
  .var-input {
    width: 100%;
    padding: 4px 8px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 12px;
    outline: none;
    box-sizing: border-box;
  }
  .var-input:focus {
    border-color: var(--color-accent);
  }
</style>
