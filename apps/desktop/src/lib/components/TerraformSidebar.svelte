<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { slide } from 'svelte/transition';
  import { invoke } from '@tauri-apps/api/core';
  import { project } from '$lib/stores/project.svelte';
  import { terraform } from '$lib/stores/terraform.svelte';
  import { diagram } from '$lib/stores/diagram.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import { generateAndWrite, runTerraformCommand, refreshDeploymentStatus } from '$lib/services/terraform-service';
  import type { TerraformCommand } from '$lib/stores/terraform.svelte';
  import { registry } from '$lib/bootstrap';
  import type { ResourceTypeId, TerraformVariable } from '@terrastudio/types';

  // Use ui store for persistent collapse state
  const filesCollapsed = $derived(ui.isCategoryCollapsed('tf-files'));
  const variablesCollapsed = $derived(ui.isCategoryCollapsed('tf-variables'));

  /**
   * Variables derived directly from diagram nodes' variableOverrides.
   * Updates in real-time as the user toggles properties to variable mode —
   * no need to wait for a generation run.
   */
  const diagramVariables = $derived.by((): TerraformVariable[] => {
    const vars: TerraformVariable[] = [];
    for (const node of diagram.nodes) {
      const overrides = node.data.variableOverrides as Record<string, string> | undefined;
      if (!overrides) continue;
      const schema = registry.getResourceSchema(node.data.typeId as ResourceTypeId);
      if (!schema) continue;
      for (const [propKey, mode] of Object.entries(overrides)) {
        if (mode !== 'variable') continue;
        const propSchema = schema.properties.find(p => p.key === propKey);
        if (!propSchema) continue;
        const varName = `${node.data.terraformName}_${propKey}`;
        let varType = 'string';
        if (propSchema.type === 'number') varType = 'number';
        else if (propSchema.type === 'boolean') varType = 'bool';
        const currentValue = node.data.properties[propKey];
        vars.push({
          name: varName,
          type: varType,
          description: `${propSchema.label} for ${node.data.label || node.data.terraformName}`,
          defaultValue: currentValue !== undefined && currentValue !== '' ? currentValue : undefined,
          sensitive: propSchema.sensitive ?? false,
        });
      }
    }
    return vars;
  });

  /**
   * Merged display list: diagram-derived variables are the real-time source of truth.
   * After generation, collectedVariables (from the pipeline) take precedence for any
   * matching names since they carry richer metadata (sensitive flag, actual default).
   */
  const displayVariables = $derived.by((): TerraformVariable[] => {
    if (terraform.collectedVariables.length === 0) return diagramVariables;
    const collectedNames = new Set(terraform.collectedVariables.map(v => v.name));
    const extra = diagramVariables.filter(v => !collectedNames.has(v.name));
    return [...terraform.collectedVariables, ...extra];
  });

  // Debounce timer for auto-regenerate
  let autoRegenTimer: ReturnType<typeof setTimeout> | null = null;

  // Watch for diagram changes when auto-regenerate is enabled
  $effect(() => {
    // Track the filesStale state
    const isStale = terraform.filesStale;
    const autoRegen = terraform.autoRegenerate;
    const isOpen = project.isOpen;
    const hasNodes = diagram.nodes.length > 0;
    const isRunning = terraform.isRunning;
    const isBlocked = terraform.autoRegenBlocked;

    // Use untrack for the regeneration logic to prevent re-triggering
    untrack(() => {
      if (autoRegen && isStale && isOpen && hasNodes && !isRunning && !isBlocked) {
        // Clear any existing timer
        if (autoRegenTimer) {
          clearTimeout(autoRegenTimer);
        }
        // Debounce the regeneration to avoid excessive calls during rapid changes
        autoRegenTimer = setTimeout(async () => {
          autoRegenTimer = null;
          try {
            await generateAndWrite();
          } catch {
            // Block auto-regen until the diagram actually changes
            terraform.autoRegenBlocked = true;
          }
        }, 1000);
      }
    });
  });

  const canGenerate = $derived(
    project.isOpen && diagram.nodes.length > 0 && !terraform.isRunning,
  );
  const canRunCommand = $derived(project.isOpen && terraform.canRun);

  /** Variables that have no default and no user-supplied value */
  const missingRequiredVars = $derived(
    displayVariables.filter(
      (v) =>
        (v.defaultValue === undefined || v.defaultValue === '') &&
        !(project.projectConfig.variableValues[v.name]),
    ),
  );

  let showVarWarning = $state(false);

  // Debounce timer for variable value changes
  let varDebounceTimer: ReturnType<typeof setTimeout> | null = null;

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

  // Auto-load existing .tf files when the sidebar mounts or the project changes
  onMount(() => {
    loadExistingFiles();
  });

  async function loadExistingFiles() {
    if (!project.path) return;
    try {
      const files = await invoke<string[]>('list_terraform_files', {
        projectPath: project.path,
      });
      if (files.length > 0) {
        ui.generatedFiles = files;
      }
    } catch {
      // No terraform directory yet — that's fine
    }
  }

  async function handleGenerate() {
    terraform.clearOutput();
    ui.showTerminal = true;
    try {
      await generateAndWrite();
    } catch {
      // Error already logged to terraform store
    }
  }

  async function handleCommand(command: TerraformCommand) {
    if (command === 'apply' && missingRequiredVars.length > 0) {
      showVarWarning = true;
      return;
    }
    showVarWarning = false;
    ui.showTerminal = true;

    const success = await runTerraformCommand(command);
    if ((command === 'apply' || command === 'destroy') && success) {
      await refreshDeploymentStatus();
    }
  }

  async function forceApply() {
    showVarWarning = false;
    ui.showTerminal = true;
    const success = await runTerraformCommand('apply');
    if (success) {
      await refreshDeploymentStatus();
    }
  }

  function openFile(filename: string) {
    ui.openFileTab(filename);
  }
</script>

<div class="tf-sidebar">
  <!-- Generated Files (top) -->
  <div class="section files-section">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="section-header clickable" onclick={() => ui.toggleCategory('tf-files')}>
      <svg class="chevron" class:collapsed={filesCollapsed} width="12" height="12" viewBox="0 0 12 12">
        <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <span>FILES</span>
      <span class="section-count">{ui.generatedFiles.length}</span>
    </div>
    {#if !filesCollapsed}
      <div class="section-content" transition:slide={{ duration: 150 }}>
        {#if ui.generatedFiles.length === 0}
          <p class="empty-hint">No terraform files yet. Add resources and generate.</p>
        {:else}
          <div class="file-list">
            {#each ui.generatedFiles as filename (filename)}
              <button class="file-item" onclick={() => openFile(filename)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span>{filename}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Variables Section -->
  {#if displayVariables.length > 0}
    <div class="section variables-section">
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div class="section-header clickable" onclick={() => ui.toggleCategory('tf-variables')}>
        <svg class="chevron" class:collapsed={variablesCollapsed} width="12" height="12" viewBox="0 0 12 12">
          <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>VARIABLES</span>
        <span class="section-count">{displayVariables.length}</span>
      </div>
      {#if !variablesCollapsed}
        <div class="section-content" transition:slide={{ duration: 150 }}>
          {#each displayVariables as v (v.name)}
            {@const currentValue = project.projectConfig.variableValues[v.name] ?? ''}
            {@const hasDefault = v.defaultValue !== undefined && v.defaultValue !== ''}
            {@const isMissing = !hasDefault && !currentValue}
            <div class="var-row" class:var-missing={isMissing}>
              <div class="var-header">
                <span class="var-name">{v.name}</span>
                <span class="var-type-badge">{v.type}</span>
              </div>
              {#if hasDefault}
                <span class="var-default">default: {v.defaultValue}</span>
              {/if}
              <input
                type={v.sensitive ? 'password' : 'text'}
                class="var-input"
                placeholder={hasDefault ? String(v.defaultValue) : 'required'}
                value={currentValue}
                oninput={(e) => onVariableValueChange(v.name, (e.target as HTMLInputElement).value)}
              />
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Spacer to push commands to bottom -->
  <div class="spacer"></div>

  {#if showVarWarning}
    <div class="var-warning">
      <span>Missing {missingRequiredVars.length} required variable{missingRequiredVars.length > 1 ? 's' : ''}:</span>
      <span class="var-names">{missingRequiredVars.map(v => v.name).join(', ')}</span>
      <div class="var-warning-actions">
        <button class="warn-btn" onclick={forceApply}>Apply Anyway</button>
        <button class="warn-btn" onclick={() => (showVarWarning = false)}>Dismiss</button>
      </div>
    </div>
  {/if}

  <!-- Stale files warning -->
  {#if terraform.filesStale && ui.generatedFiles.length > 0}
    <div class="stale-warning">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <span>Diagram changed - regenerate before running</span>
    </div>
  {/if}

  <!-- Commands (bottom) -->
  <div class="section commands-section">
    <div class="section-header">COMMANDS</div>
    <div class="cmd-buttons">
      <div class="generate-row">
        <button class="cmd-btn cmd-btn-accent generate-btn" class:cmd-btn-stale={terraform.filesStale && ui.generatedFiles.length > 0} disabled={!canGenerate} onclick={handleGenerate}>
          {#if terraform.filesStale && ui.generatedFiles.length > 0}
            Regenerate
          {:else}
            Generate
          {/if}
        </button>
        <label class="auto-toggle" title="Auto-regenerate when diagram changes">
          <input
            type="checkbox"
            checked={terraform.autoRegenerate}
            onchange={(e) => terraform.setAutoRegenerate((e.target as HTMLInputElement).checked)}
          />
          <span class="auto-label">Auto</span>
        </label>
      </div>
      <div class="cmd-row">
        <button class="cmd-btn" disabled={!canRunCommand} onclick={() => handleCommand('init')}>Init</button>
        <button class="cmd-btn" disabled={!canRunCommand} onclick={() => handleCommand('validate')}>Validate</button>
      </div>
      <div class="cmd-row">
        <button class="cmd-btn" disabled={!canRunCommand} onclick={() => handleCommand('plan')}>Plan</button>
        <button class="cmd-btn cmd-btn-primary" disabled={!canRunCommand} onclick={() => handleCommand('apply')}>Apply</button>
      </div>
      <button class="cmd-btn cmd-btn-danger" disabled={!canRunCommand} onclick={() => handleCommand('destroy')}>
        Destroy
      </button>
      <button
        class="cmd-btn"
        disabled={terraform.isRunning || !project.isOpen}
        onclick={async () => {
          terraform.appendInfo('\n--- Refreshing deployment status ---');
          await refreshDeploymentStatus();
          terraform.appendInfo('Status refreshed.');
        }}
      >
        Refresh Status
      </button>
    </div>
  </div>
</div>

<style>
  .tf-sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .section {
    flex-shrink: 0;
    border-bottom: 1px solid var(--color-border);
  }
  .files-section {
    flex-shrink: 1;
    overflow-y: auto;
    min-height: 0;
  }
  .commands-section {
    border-bottom: none;
    padding: 8px 12px;
  }
  .spacer {
    flex: 1;
  }
  .section-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-accent);
    padding: 10px 12px;
    transition: background 0.1s;
  }
  .section-header.clickable {
    cursor: pointer;
    user-select: none;
  }
  .section-header.clickable:hover {
    background: var(--color-surface-hover);
  }
  .chevron {
    flex-shrink: 0;
    transition: transform 0.15s ease;
    transform: rotate(90deg);
    color: var(--color-text-muted);
  }
  .chevron.collapsed {
    transform: rotate(0deg);
  }
  .section-count {
    margin-left: auto;
    font-size: 10px;
    color: var(--color-text-muted);
    opacity: 0.6;
  }
  .section-content {
    padding: 0 12px 8px;
  }
  .cmd-buttons {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .generate-row {
    display: flex;
    gap: 6px;
    align-items: stretch;
  }
  .generate-btn {
    flex: 1;
  }
  .auto-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-bg);
    cursor: pointer;
    transition: all 0.15s;
    user-select: none;
  }
  .auto-toggle:hover {
    background: var(--color-surface-hover);
  }
  .auto-toggle input {
    margin: 0;
    cursor: pointer;
    accent-color: var(--color-accent);
  }
  .auto-toggle:has(input:checked) {
    border-color: rgba(96, 165, 250, 0.4);
    background: rgba(96, 165, 250, 0.08);
  }
  .auto-label {
    font-size: 10px;
    color: var(--color-text-muted);
    white-space: nowrap;
  }
  .auto-toggle:has(input:checked) .auto-label {
    color: #60a5fa;
  }
  .cmd-row {
    display: flex;
    gap: 4px;
  }
  .cmd-row .cmd-btn {
    flex: 1;
  }
  .cmd-btn {
    padding: 6px 10px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-bg);
    color: var(--color-text-muted);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
    width: 100%;
    text-align: center;
  }
  .cmd-btn:hover:not(:disabled) {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }
  .cmd-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .cmd-btn-accent {
    border-color: rgba(96, 165, 250, 0.25);
    color: rgba(96, 165, 250, 0.85);
  }
  .cmd-btn-accent:hover:not(:disabled) {
    background: rgba(96, 165, 250, 0.1);
    border-color: rgba(96, 165, 250, 0.4);
    color: #60a5fa;
  }
  .cmd-btn-primary {
    border-color: rgba(96, 165, 250, 0.25);
    color: rgba(96, 165, 250, 0.85);
  }
  .cmd-btn-primary:hover:not(:disabled) {
    background: rgba(96, 165, 250, 0.1);
    border-color: rgba(96, 165, 250, 0.4);
    color: #60a5fa;
  }
  .cmd-btn-danger {
    color: rgba(239, 68, 68, 0.6);
    border-color: rgba(239, 68, 68, 0.15);
  }
  .cmd-btn-danger:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.08);
    border-color: rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }
  .var-warning {
    padding: 8px;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 4px;
    font-size: 11px;
    color: #f59e0b;
    margin-bottom: 8px;
    flex-shrink: 0;
  }
  .var-names {
    display: block;
    font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
    font-size: 10px;
    margin: 4px 0;
  }
  .var-warning-actions {
    display: flex;
    gap: 4px;
    margin-top: 6px;
  }
  .warn-btn {
    padding: 2px 8px;
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 3px;
    background: transparent;
    color: #f59e0b;
    font-size: 10px;
    cursor: pointer;
  }
  .warn-btn:hover {
    background: rgba(245, 158, 11, 0.15);
  }
  .empty-hint {
    font-size: 11px;
    color: var(--color-text-muted);
    margin: 4px 0;
    opacity: 0.7;
  }
  .file-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .file-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 12px;
    cursor: pointer;
    text-align: left;
    width: 100%;
  }
  .file-item:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }
  .file-item svg {
    flex-shrink: 0;
    opacity: 0.6;
  }
  .stale-warning {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.25);
    border-radius: 4px;
    font-size: 10px;
    color: #f59e0b;
    margin-bottom: 8px;
    flex-shrink: 0;
  }
  .stale-warning svg {
    flex-shrink: 0;
  }
  .cmd-btn-stale {
    border-color: rgba(245, 158, 11, 0.4) !important;
    color: #f59e0b !important;
    animation: pulse-stale 2s ease-in-out infinite;
  }
  .cmd-btn-stale:hover:not(:disabled) {
    background: rgba(245, 158, 11, 0.15) !important;
    border-color: rgba(245, 158, 11, 0.5) !important;
  }
  @keyframes pulse-stale {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
  .variables-section {
    max-height: 200px;
    overflow-y: auto;
    flex-shrink: 0;
    margin-bottom: 8px;
  }
  .var-row {
    padding: 6px 0;
    border-bottom: 1px solid var(--color-border);
  }
  .var-row:last-child {
    border-bottom: none;
  }
  .var-missing {
    border-left: 2px solid #f59e0b;
    padding-left: 6px;
  }
  .var-header {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 2px;
  }
  .var-name {
    font-size: 11px;
    font-weight: 500;
    font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
    color: var(--color-text);
  }
  .var-type-badge {
    font-size: 8px;
    padding: 1px 4px;
    border-radius: 3px;
    background: rgba(59, 130, 246, 0.12);
    color: #3b82f6;
    font-weight: 500;
  }
  .var-default {
    display: block;
    font-size: 9px;
    color: var(--color-text-muted);
    font-style: italic;
    margin-bottom: 3px;
  }
  .var-input {
    width: 100%;
    padding: 3px 6px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 11px;
    outline: none;
    box-sizing: border-box;
  }
  .var-input:focus {
    border-color: var(--color-accent);
  }
</style>
