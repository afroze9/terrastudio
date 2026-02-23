<script lang="ts">
  import { project } from '$lib/stores/project.svelte';
  import { registry } from '$lib/bootstrap';
  import { applyNamingTemplate, buildTokens } from '@terrastudio/core';
  import type { LayoutAlgorithm } from '@terrastudio/core';
  import type { NamingConvention } from '@terrastudio/types';
  import CollapsibleSection from './CollapsibleSection.svelte';
  import SearchBox from './SearchBox.svelte';

  let searchQuery = $state('');

  function sectionVisible(label: string) {
    return !searchQuery || label.toLowerCase().includes(searchQuery.toLowerCase());
  }

  let newTagKey = $state('');
  let newTagValue = $state('');

  const layoutOptions: { value: LayoutAlgorithm; label: string; desc: string }[] = [
    { value: 'dagre', label: 'Dagre', desc: 'Hierarchical layout based on edges' },
    { value: 'hybrid', label: 'Hybrid Grid', desc: 'Grid layout with reference-aware clustering' },
  ];

  // ─── Naming convention ───────────────────────────────────────────────────

  const PRESETS: { label: string; template: string }[] = [
    { label: 'CAF Standard', template: '{type}-{env}-{name}' },
    { label: 'CAF + Region',  template: '{type}-{env}-{region}-{name}' },
    { label: 'Org Prefix',    template: '{org}-{type}-{env}-{name}' },
  ];

  function defaultConvention(): NamingConvention {
    return { enabled: true, template: '{type}-{env}-{name}', env: 'dev' };
  }

  let convention = $derived(project.projectConfig.namingConvention);

  function setConventionEnabled(enabled: boolean) {
    if (enabled) {
      project.projectConfig.namingConvention = project.projectConfig.namingConvention ?? defaultConvention();
      project.projectConfig.namingConvention.enabled = true;
    } else {
      if (project.projectConfig.namingConvention) {
        project.projectConfig.namingConvention.enabled = false;
      }
    }
    project.markDirty();
  }

  function setPreset(template: string) {
    if (!project.projectConfig.namingConvention) {
      project.projectConfig.namingConvention = defaultConvention();
    }
    project.projectConfig.namingConvention.template = template;
    project.markDirty();
  }

  function setConventionField(field: keyof NamingConvention, value: string) {
    if (!project.projectConfig.namingConvention) {
      project.projectConfig.namingConvention = defaultConvention();
    }
    (project.projectConfig.namingConvention as unknown as Record<string, unknown>)[field] = value || undefined;
    project.markDirty();
  }

  // Preview examples: show 3 resource types with a placeholder slug
  const PREVIEW_TYPES = [
    { typeId: 'azurerm/compute/virtual_machine', label: 'Virtual Machine', slug: 'webserver' },
    { typeId: 'azurerm/storage/storage_account', label: 'Storage Account', slug: 'appdata' },
    { typeId: 'azurerm/compute/app_service', label: 'App Service', slug: 'api' },
  ];

  let previews = $derived.by(() => {
    const conv = convention;
    if (!conv?.enabled) return [];
    return PREVIEW_TYPES.map(({ typeId, label, slug }) => {
      const schema = registry.getResourceSchema(typeId as `${string}/${string}/${string}`);
      if (!schema?.cafAbbreviation) return { label, result: '(no abbreviation)' };
      const tokens = buildTokens(conv, schema.cafAbbreviation, slug);
      const result = applyNamingTemplate(conv.template, tokens, schema.namingConstraints);
      return { label, result };
    });
  });

  let isCustomTemplate = $derived(
    convention?.enabled &&
    !PRESETS.some(p => p.template === convention?.template)
  );

  // ─── Layout ──────────────────────────────────────────────────────────────

  function setLayoutAlgorithm(algo: LayoutAlgorithm) {
    project.projectConfig.layoutAlgorithm = algo;
    project.markDirty();
  }

  // ─── Tags ────────────────────────────────────────────────────────────────

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
  <SearchBox bind:value={searchQuery} placeholder="Search settings..." />

  <!-- Naming Convention -->
  {#if sectionVisible('Naming Convention')}
  <CollapsibleSection id="project-naming" label="Naming Convention" forceExpand={!!searchQuery}>
    <label class="toggle-row">
      <input
        type="checkbox"
        checked={convention?.enabled ?? false}
        onchange={(e) => setConventionEnabled((e.target as HTMLInputElement).checked)}
      />
      <span class="toggle-label">Enable naming convention</span>
    </label>

    {#if convention?.enabled}
      <!-- Presets -->
      <div class="preset-row">
        {#each PRESETS as preset}
          <button
            class="preset-btn"
            class:active={convention.template === preset.template}
            onclick={() => setPreset(preset.template)}
          >{preset.label}</button>
        {/each}
        <button
          class="preset-btn"
          class:active={isCustomTemplate}
          onclick={() => {}}
        >Custom</button>
      </div>

      <!-- Template input -->
      <div class="conv-field">
        <span class="conv-label">Template</span>
        <input
          type="text"
          class="conv-input"
          value={convention.template}
          oninput={(e) => setConventionField('template', (e.target as HTMLInputElement).value)}
          placeholder={'{type}-{env}-{name}'}
        />
        <span class="conv-hint">Tokens: <code>{'{type}'}</code> <code>{'{env}'}</code> <code>{'{name}'}</code> <code>{'{region}'}</code> <code>{'{org}'}</code></span>
      </div>

      <!-- Token inputs -->
      <div class="conv-tokens">
        <div class="conv-field half">
          <span class="conv-label">Environment <span class="required">*</span></span>
          <input
            type="text"
            class="conv-input"
            value={convention.env}
            oninput={(e) => setConventionField('env', (e.target as HTMLInputElement).value)}
            placeholder="dev"
          />
        </div>
        <div class="conv-field half">
          <span class="conv-label">Region <span class="optional">(optional)</span></span>
          <input
            type="text"
            class="conv-input"
            value={convention.region ?? ''}
            oninput={(e) => setConventionField('region', (e.target as HTMLInputElement).value)}
            placeholder="eus2"
          />
        </div>
        <div class="conv-field half">
          <span class="conv-label">Org prefix <span class="optional">(optional)</span></span>
          <input
            type="text"
            class="conv-input"
            value={convention.org ?? ''}
            oninput={(e) => setConventionField('org', (e.target as HTMLInputElement).value)}
            placeholder="contoso"
          />
        </div>
      </div>

      <!-- Live preview -->
      {#if previews.length > 0}
        <div class="preview-block">
          <span class="preview-title">Preview</span>
          {#each previews as p}
            <div class="preview-row">
              <span class="preview-resource">{p.label}</span>
              <span class="preview-name">{p.result}</span>
            </div>
          {/each}
        </div>
      {/if}

      <p class="section-hint" style="margin-top: 6px;">Applied to new resources on drop. Existing resources are not renamed.</p>
    {/if}
  </CollapsibleSection>
  {/if}

  <!-- Layout Algorithm -->
  {#if sectionVisible('Layout')}
  <CollapsibleSection id="project-layout" label="Layout" forceExpand={!!searchQuery}>
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
  </CollapsibleSection>
  {/if}

  <!-- Common Tags Section -->
  {#if sectionVisible('Common Tags')}
  <CollapsibleSection id="project-tags" label="Common Tags" forceExpand={!!searchQuery}>
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
  </CollapsibleSection>
  {/if}
</div>

<style>
  .config-panel {
    width: 100%;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }
  .section-hint {
    font-size: 11px;
    color: var(--color-text-muted);
    margin: 0 0 8px;
  }

  /* Naming convention */
  .toggle-row {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    margin-bottom: 10px;
  }
  .toggle-row input[type='checkbox'] {
    accent-color: var(--color-accent);
  }
  .toggle-label {
    font-size: 12px;
    color: var(--color-text);
  }
  .preset-row {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }
  .preset-btn {
    padding: 3px 8px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.1s;
  }
  .preset-btn:hover {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }
  .preset-btn.active {
    border-color: var(--color-accent);
    background: rgba(var(--color-accent-rgb, 59, 130, 246), 0.08);
    color: var(--color-accent);
  }
  .conv-field {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin-bottom: 8px;
  }
  .conv-tokens {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .conv-label {
    font-size: 11px;
    color: var(--color-text-muted);
    font-weight: 500;
  }
  .conv-input {
    padding: 5px 8px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 12px;
    outline: none;
    width: 100%;
    box-sizing: border-box;
    font-family: 'Cascadia Code', 'Fira Code', monospace;
  }
  .conv-input:focus {
    border-color: var(--color-accent);
  }
  .conv-hint {
    font-size: 10px;
    color: var(--color-text-muted);
    opacity: 0.7;
  }
  .conv-hint code {
    font-family: 'Cascadia Code', 'Fira Code', monospace;
    background: var(--color-surface-hover);
    padding: 1px 3px;
    border-radius: 2px;
  }
  .required {
    color: #ef4444;
  }
  .optional {
    font-weight: normal;
    opacity: 0.6;
  }
  .preview-block {
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 8px 10px;
    margin-top: 4px;
  }
  .preview-title {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
    display: block;
    margin-bottom: 6px;
  }
  .preview-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 0;
    gap: 8px;
  }
  .preview-resource {
    font-size: 11px;
    color: var(--color-text-muted);
    flex-shrink: 0;
  }
  .preview-name {
    font-size: 11px;
    font-weight: 500;
    color: var(--color-text);
    font-family: 'Cascadia Code', 'Fira Code', monospace;
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
